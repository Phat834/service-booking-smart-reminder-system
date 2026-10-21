import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import dotenv from 'dotenv';
import { PrismaClient, Role, BookingStatus } from '@prisma/client';

const BACKEND_ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });

const PORT = process.env.PORT || '5000';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const CONCURRENT_REQUESTS = Number(process.env.CONCURRENCY || '10');
const SLOT_CONFLICT_MESSAGE = 'Khung giờ này vừa có người đặt, vui lòng chọn khung giờ khác!';
const TEST_NOTE_PREFIX = '[concurrency-test]';

const prisma = new PrismaClient();

interface HttpResult {
  status: number;
  body: any;
  durationMs: number;
}

const request = async (
  method: string,
  endpoint: string,
  payload?: unknown,
  token?: string
): Promise<HttpResult> => {
  const startedAt = Date.now();
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const text = await response.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { status: response.status, body, durationMs: Date.now() - startedAt };
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const isServerUp = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${BASE_URL}/api/health`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
};

let serverProcess: ChildProcess | null = null;

const startServerIfNeeded = async (): Promise<void> => {
  if (await isServerUp()) {
    console.log(`[setup] Server đang chạy tại ${BASE_URL} (dùng server hiện có).`);
    return;
  }

  console.log(`[setup] Không tìm thấy server tại ${BASE_URL}, đang khởi động server...`);
  const tsNodeBin = path.join(BACKEND_ROOT, 'node_modules', 'ts-node', 'dist', 'bin.js');
  serverProcess = spawn(process.execPath, [tsNodeBin, 'src/index.ts'], {
    cwd: BACKEND_ROOT,
    env: process.env,
    stdio: 'inherit',
  });

  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    await sleep(1000);
    if (await isServerUp()) {
      console.log(`[setup] Server đã sẵn sàng tại ${BASE_URL}.`);
      return;
    }
  }

  throw new Error('Không thể khởi động server trong thời gian cho phép!');
};

const stopServer = (): void => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    console.log('[setup] Đã tắt server do script khởi động.');
  }
};

const login = async (): Promise<string> => {
  const seeded = await request('POST', '/api/auth/login', {
    email: 'customer1@demo.com',
    password: '123456',
  });

  if (seeded.status === 200 && seeded.body?.token) {
    console.log('[setup] Đăng nhập thành công với tài khoản customer1@demo.com.');
    return seeded.body.token;
  }

  const email = `concurrency-${Date.now()}@test.com`;
  const registered = await request('POST', '/api/auth/register', {
    email,
    password: '123456',
    fullName: 'Concurrency Tester',
  });

  if (registered.status !== 201) {
    throw new Error(
      `Không thể đăng ký tài khoản test (${registered.status}): ${JSON.stringify(registered.body)}`
    );
  }

  const loginAgain = await request('POST', '/api/auth/login', { email, password: '123456' });
  if (loginAgain.status !== 200 || !loginAgain.body?.token) {
    throw new Error(
      `Không thể đăng nhập tài khoản test (${loginAgain.status}): ${JSON.stringify(loginAgain.body)}`
    );
  }

  console.log(`[setup] Đã đăng ký tài khoản test mới: ${email}`);
  return loginAgain.body.token;
};

const buildFixtures = async () => {
  let staff = await prisma.user.findFirst({ where: { role: Role.STAFF } });
  if (!staff) {
    staff = await prisma.user.create({
      data: {
        fullName: 'Concurrency Staff',
        email: `concurrency-staff-${Date.now()}@test.com`,
        passwordHash: 'x',
        role: Role.STAFF,
      },
    });
  }

  let service = await prisma.service.findFirst({ where: { isActive: true } });
  if (!service) {
    service = await prisma.service.create({
      data: {
        name: 'Concurrency Service',
        description: 'Dịch vụ dùng cho test đồng thời',
        durationMinutes: 30,
        price: 100000,
        isActive: true,
      },
    });
  }

  let timeSlot = await prisma.timeSlot.findFirst();
  if (!timeSlot) {
    timeSlot = await prisma.timeSlot.create({
      data: { startTime: '08:00', endTime: '08:30' },
    });
  }

  const target = new Date();
  target.setUTCDate(target.getUTCDate() + 60);
  const bookingDate = target.toISOString().slice(0, 10);

  await prisma.booking.deleteMany({
    where: {
      staffId: staff.id,
      timeSlotId: timeSlot.id,
      bookingDate: new Date(`${bookingDate}T00:00:00.000Z`),
    },
  });

  return { staff, service, timeSlot, bookingDate };
};

const printTable = (rows: Array<{ index: number; result: HttpResult }>): void => {
  const header = ['#', 'HTTP Status', 'Kết quả', 'Thời gian (ms)', 'Message'];
  const body = rows.map((row) => {
    const status = String(row.result.status);
    const outcome =
      row.result.status === 201
        ? 'CREATED'
        : row.result.status === 409
          ? 'CONFLICT'
          : 'ERROR';
    const message =
      typeof row.result.body?.message === 'string'
        ? row.result.body.message
        : row.result.status === 201
          ? `bookingId=${row.result.body?.booking?.id}`
          : '-';
    return [String(row.index), status, outcome, String(row.result.durationMs), message];
  });

  const widths = header.map((cell, columnIndex) =>
    Math.max(cell.length, ...body.map((row) => row[columnIndex].length))
  );

  const separator = `+${widths.map((width) => '-'.repeat(width + 2)).join('+')}+`;
  const line = (cells: string[]): string =>
    `| ${cells.map((cell, columnIndex) => cell.padEnd(widths[columnIndex])).join(' | ')} |`;

  console.log(separator);
  console.log(line(header));
  console.log(separator);
  body.forEach((row) => console.log(line(row)));
  console.log(separator);
};

const main = async (): Promise<void> => {
  console.log('='.repeat(78));
  console.log('  TEST ĐỒNG THỜI (RACE CONDITION) - ĐẶT LỊCH VÀ CÙNG MỘT KHUNG GIỜ');
  console.log('='.repeat(78));

  await startServerIfNeeded();
  const token = await login();
  const { staff, service, timeSlot, bookingDate } = await buildFixtures();

  console.log(`[target] staffId    = ${staff.id} (${staff.fullName})`);
  console.log(`[target] serviceId  = ${service.id} (${service.name})`);
  console.log(`[target] timeSlotId = ${timeSlot.id} (${timeSlot.startTime} - ${timeSlot.endTime})`);
  console.log(`[target] bookingDate= ${bookingDate}`);
  console.log(`[target] Số request đồng thời = ${CONCURRENT_REQUESTS}`);
  console.log('-'.repeat(78));

  const startedAt = Date.now();
  const results = await Promise.all(
    Array.from({ length: CONCURRENT_REQUESTS }, async (_unused, index) => {
      const result = await request(
        'POST',
        '/api/bookings',
        {
          staffId: staff.id,
          serviceId: service.id,
          timeSlotId: timeSlot.id,
          bookingDate,
          notes: `${TEST_NOTE_PREFIX} request#${index + 1} @${Date.now()}`,
        },
        token
      );
      return { index: index + 1, result };
    })
  );
  const elapsedMs = Date.now() - startedAt;

  printTable(results);

  const created = results.filter((row) => row.result.status === 201);
  const conflicts = results.filter((row) => row.result.status === 409);
  const others = results.filter(
    (row) => row.result.status !== 201 && row.result.status !== 409
  );

  const rowsInDb = await prisma.booking.count({
    where: {
      staffId: staff.id,
      timeSlotId: timeSlot.id,
      bookingDate: new Date(`${bookingDate}T00:00:00.000Z`),
      status: { not: BookingStatus.CANCELLED },
    },
  });

  console.log('');
  console.log('TỔNG KẾT');
  console.log('-'.repeat(78));
  console.log(`  201 Created           : ${created.length}`);
  console.log(`  409 Conflict          : ${conflicts.length}`);
  console.log(`  Kết quả khác          : ${others.length}`);
  console.log(`  Số bản ghi trong DB   : ${rowsInDb}`);
  console.log(`  Thời gian xử lý       : ${elapsedMs} ms`);
  console.log('');

  if (created.length > 0) {
    console.log('  Booking được tạo thành công:');
    console.log(`    id         = ${created[0].result.body?.booking?.id}`);
    console.log(`    customerId = ${created[0].result.body?.booking?.customerId}`);
    console.log(`    status     = ${created[0].result.body?.booking?.status}`);
  }

  if (conflicts.length > 0) {
    console.log('  Message trả về cho các request bị xung đột:');
    console.log(`    "${conflicts[0].result.body?.message}"`);
  }

  const allConflictsUseExpectedMessage = conflicts.every(
    (row) => row.result.body?.message === SLOT_CONFLICT_MESSAGE
  );

  console.log('');
  const passed =
    created.length === 1 &&
    conflicts.length === CONCURRENT_REQUESTS - 1 &&
    others.length === 0 &&
    rowsInDb === 1 &&
    allConflictsUseExpectedMessage;

  if (passed) {
    console.log('  KẾT QUẢ: PASS - Chỉ 1 request tạo booking, các request còn lại nhận 409 Conflict.');
  } else {
    console.log(
      '  KẾT QUẢ: FAIL - Kỳ vọng 1 x 201, 9 x 409, 1 bản ghi trong DB và đúng message xung đột.'
    );
  }
  console.log('='.repeat(78));

  stopServer();
  await prisma.$disconnect();

  process.exit(passed ? 0 : 1);
};

main().catch(async (error) => {
  console.error('[LỖI]', error);
  stopServer();
  await prisma.$disconnect();
  process.exit(1);
});
