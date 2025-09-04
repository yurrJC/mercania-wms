const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

async function setupDatabase() {
  console.log('🚀 Setting up database...');
  
  try {
    // Generate Prisma client
    console.log('📦 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    // Push schema to database
    console.log('🗄️ Pushing schema to database...');
    execSync('npx prisma db push', { stdio: 'inherit' });
    
    // Seed database if needed
    console.log('🌱 Database setup complete!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();
