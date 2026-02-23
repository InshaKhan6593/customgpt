import { PrismaClient, UserRole, WebletCategory, AccessType, FlowMode, VersionStatus, SubStatus, TxType, TxStatus, PayoutStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Clean existing data for idempotency
  await prisma.user.deleteMany()

  // 1. Create Users (2 Developers, 2 Users)
  const devAlex = await prisma.user.create({
    data: {
      name: 'Developer Alex',
      email: 'alex@example.com',
      role: UserRole.DEVELOPER,
    },
  })

  const devSam = await prisma.user.create({
    data: {
      name: 'Developer Sam',
      email: 'sam@example.com',
      role: UserRole.DEVELOPER,
    },
  })

  const userJordan = await prisma.user.create({
    data: {
      name: 'User Jordan',
      email: 'jordan@example.com',
      role: UserRole.USER,
    },
  })

  const userTaylor = await prisma.user.create({
    data: {
      name: 'User Taylor',
      email: 'taylor@example.com',
      role: UserRole.USER,
    },
  })

  // 2. Create Weblets
  const blogWriter = await prisma.weblet.create({
    data: {
      developerId: devAlex.id,
      name: 'Blog Writer',
      slug: 'blog-writer',
      description: 'Generates SEO-optimized blog posts.',
      category: WebletCategory.WRITING,
      isPublic: true,
      accessType: AccessType.FREE,
      versions: {
        create: {
          versionNum: 1,
          prompt: 'You are an expert SEO blog writer. Write an engaging post about the given topic.',
          status: VersionStatus.ACTIVE,
        }
      }
    }
  })

  const codeReviewer = await prisma.weblet.create({
    data: {
      developerId: devAlex.id,
      name: 'Code Reviewer',
      slug: 'code-reviewer',
      description: 'Reviews code for best practices and bugs.',
      category: WebletCategory.CODE,
      isPublic: true,
      accessType: AccessType.FREE,
      versions: {
        create: {
          versionNum: 1,
          prompt: 'You are a senior engineer. Review the provided code snippet.',
          status: VersionStatus.ACTIVE,
        }
      }
    }
  })

  const dataAnalyzer = await prisma.weblet.create({
    data: {
      developerId: devAlex.id,
      name: 'Data Analyzer',
      slug: 'data-analyzer',
      description: 'Analyzes CSV data and provides insights.',
      category: WebletCategory.DATA_ANALYSIS,
      isPublic: true,
      accessType: AccessType.SUBSCRIBERS_ONLY,
      monthlyPrice: 5.0,
      versions: {
        create: {
          versionNum: 1,
          prompt: 'Analyze the provided data and extract key trends.',
          status: VersionStatus.ACTIVE,
        }
      }
    }
  })

  const marketingGenius = await prisma.weblet.create({
    data: {
      developerId: devSam.id,
      name: 'Marketing Genius',
      slug: 'marketing-genius',
      description: 'Creates marketing copy for social media.',
      category: WebletCategory.MARKETING,
      isPublic: true,
      accessType: AccessType.FREE,
      versions: {
        create: {
          versionNum: 1,
          prompt: 'Create 3 engaging tweets for the given product.',
          status: VersionStatus.ACTIVE,
        }
      }
    }
  })

  const productivityCoach = await prisma.weblet.create({
    data: {
      developerId: devSam.id,
      name: 'Productivity Coach',
      slug: 'productivity-coach',
      description: 'Helps you plan your week effectively.',
      category: WebletCategory.PRODUCTIVITY,
      isPublic: true,
      accessType: AccessType.SUBSCRIBERS_ONLY,
      monthlyPrice: 10.0,
      versions: {
        create: {
          versionNum: 1,
          prompt: 'Help the user plan their week based on their goals.',
          status: VersionStatus.ACTIVE,
        }
      }
    }
  })

  // 3. Create Sample Knowledge File
  await prisma.knowledgeFile.create({
    data: {
      webletId: dataAnalyzer.id,
      filename: 'sample_trends.csv',
      fileSize: 1024,
      mimeType: 'text/csv',
      storageKey: 'sample_trends_abc123.csv',
    }
  })

  // 4. Create User Flow for Jordan
  await prisma.userFlow.create({
    data: {
      userId: userJordan.id,
      name: 'Blog to Code Review Pipeline',
      description: 'Writes a technical blog and reviews the code snippets inside it.',
      mode: FlowMode.SEQUENTIAL,
      isPublic: true,
      steps: [
        { webletId: blogWriter.id, order: 1, inputMapping: 'original', hitlGate: false },
        { webletId: codeReviewer.id, order: 2, inputMapping: 'previous_output', hitlGate: true }
      ]
    }
  })

  // 5. Create Subscriptions
  await prisma.subscription.create({
    data: {
      userId: userJordan.id,
      status: SubStatus.ACTIVE,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    }
  })

  // 6. Create Transactions
  await prisma.transaction.create({
    data: {
      userId: userJordan.id,
      amount: 5.0,
      type: TxType.SUBSCRIPTION_PAYMENT,
      status: TxStatus.COMPLETED,
    }
  })

  // 7. Create Payouts
  await prisma.payout.create({
    data: {
      developerId: devAlex.id,
      amount: 4.25, // 5.0 - platform fee
      status: PayoutStatus.COMPLETED,
    }
  })

  // 8. Create Analytics Events
  const events = [];
  const weblets = [blogWriter, codeReviewer, dataAnalyzer, marketingGenius, productivityCoach]
  for (let i = 0; i < 50; i++) {
    events.push({
      webletId: weblets[i % weblets.length].id,
      eventType: i % 3 === 0 ? 'chat_started' : (i % 3 === 1 ? 'chat_completed' : 'rating_given'),
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Random date within last 30 days
    })
  }
  
  await prisma.analyticsEvent.createMany({
    data: events
  })

  console.log('Database seeded successfully.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
