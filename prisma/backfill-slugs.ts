import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  const jobs = await prisma.job.findMany({ where: { slug: null } });

  if (jobs.length === 0) {
    console.log('No jobs need slug backfill.');
    return;
  }

  console.log(`Backfilling slugs for ${jobs.length} jobs...`);

  for (const job of jobs) {
    const base = slugify(job.title);
    let candidate = base;
    let counter = 1;

    while (true) {
      const existing = await prisma.job.findUnique({ where: { slug: candidate } });
      if (!existing || existing.id === job.id) break;
      counter++;
      candidate = `${base}-${counter}`;
    }

    await prisma.job.update({
      where: { id: job.id },
      data: { slug: candidate },
    });
    console.log(`  ${job.title} → ${candidate}`);
  }

  console.log('Done.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
