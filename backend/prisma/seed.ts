import { PrismaClient, EmailJobStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data for ReachInbox Scheduler...');

  // 1. Create default evaluator user
  const user = await prisma.user.upsert({
    where: { email: 'intern.evaluator@reachinbox.ai' },
    update: {},
    create: {
      googleId: 'google_seed_evaluator_001',
      email: 'intern.evaluator@reachinbox.ai',
      name: 'ReachInbox Evaluator',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ReachInbox',
    },
  });

  // 2. Create default sender
  const sender = await prisma.sender.upsert({
    where: {
      userId_email: {
        userId: user.id,
        email: user.email,
      },
    },
    update: {},
    create: {
      userId: user.id,
      email: user.email,
      name: user.name,
      hourlyLimit: 100,
      minDelayMs: 2000,
    },
  });

  // 3. Create a sample scheduled email and sent email for instant verification
  await prisma.emailJob.createMany({
    data: [
      {
        userId: user.id,
        senderId: sender.id,
        toEmail: 'welcome.client@company.org',
        subject: 'Welcome to ReachInbox.ai Distributed Scheduler',
        body: 'This is a sample scheduled delayed email proving persistent queue and database state.',
        scheduledAt: new Date(Date.now() + 60000), // 1 minute in the future
        status: EmailJobStatus.SCHEDULED,
      },
      {
        userId: user.id,
        senderId: sender.id,
        toEmail: 'verified.lead@enterprise.com',
        subject: 'ReachInbox Architecture Brief',
        body: 'Sample sent email demonstration with safe DB idempotency.',
        scheduledAt: new Date(Date.now() - 300000),
        status: EmailJobStatus.SENT,
        sentAt: new Date(Date.now() - 295000),
        messageId: '<test-seed-message-id@ethereal.email>',
        previewUrl: 'https://ethereal.email',
      },
    ],
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
