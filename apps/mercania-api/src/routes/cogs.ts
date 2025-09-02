import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Helper function to calculate financial year (July 1 - June 30)
const getFinancialYear = (date: Date): number => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // getMonth() returns 0-11
  
  // If the month is July (7) or later, it's the current financial year
  // If the month is before July, it's the previous financial year
  return month >= 7 ? year + 1 : year;
};

// Helper function to calculate financial year month (1-12 where 1=July, 2=August, etc.)
const getFinancialYearMonth = (date: Date): number => {
  const month = date.getMonth() + 1; // getMonth() returns 0-11
  
  // Financial year starts in July (month 7)
  // July = FY month 1, August = FY month 2, ..., June = FY month 12
  if (month >= 7) {
    return month - 6; // July (7) becomes 1, August (8) becomes 2, etc.
  } else {
    return month + 6; // January (1) becomes 7, February (2) becomes 8, ..., June (6) becomes 12
  }
};

// GET /cogs/summary - Get COGS summary statistics
router.get('/summary', async (req, res): Promise<any> => {
  try {
    const now = new Date();
    const currentFinancialYear = getFinancialYear(now);
    
    // Calculate financial year start and end dates
    const fyStart = new Date(currentFinancialYear - 1, 6, 1); // July 1st
    const fyEnd = new Date(currentFinancialYear, 5, 30, 23, 59, 59); // June 30th
    
    // Get all-time COGS
    const allTimeCOGS = await prisma.cOGSRecord.aggregate({
      _sum: {
        costCents: true
      },
      _count: {
        id: true
      }
    });
    
    // Get current financial year COGS
    const currentFYCOGS = await prisma.cOGSRecord.aggregate({
      where: {
        financialYear: currentFinancialYear
      },
      _sum: {
        costCents: true
      },
      _count: {
        id: true
      }
    });
    
    // Get previous financial year for comparison
    const previousFYCOGS = await prisma.cOGSRecord.aggregate({
      where: {
        financialYear: currentFinancialYear - 1
      },
      _sum: {
        costCents: true
      }
    });
    
    // Calculate year-over-year growth
    const currentFYAmount = currentFYCOGS._sum.costCents || 0;
    const previousFYAmount = previousFYCOGS._sum.costCents || 0;
    const yoyGrowth = previousFYAmount > 0 
      ? ((currentFYAmount - previousFYAmount) / previousFYAmount) * 100 
      : 0;
    
    res.set('Cache-Control', 'public, max-age=300'); // 5 minutes cache
    
    res.json({
      success: true,
      data: {
        allTime: {
          totalCostCents: allTimeCOGS._sum.costCents || 0,
          totalItems: allTimeCOGS._count.id || 0,
          averageCostCents: allTimeCOGS._count.id > 0 
            ? Math.round((allTimeCOGS._sum.costCents || 0) / allTimeCOGS._count.id)
            : 0
        },
        currentFinancialYear: {
          year: currentFinancialYear,
          totalCostCents: currentFYAmount,
          totalItems: currentFYCOGS._count.id || 0,
          averageCostCents: (currentFYCOGS._count.id || 0) > 0 
            ? Math.round(currentFYAmount / (currentFYCOGS._count.id || 1))
            : 0,
          yoyGrowthPercent: Math.round(yoyGrowth * 100) / 100,
          periodStart: fyStart.toISOString(),
          periodEnd: fyEnd.toISOString()
        }
      }
    });
    
  } catch (error) {
    console.error('COGS summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get COGS summary'
    });
  }
});

// GET /cogs/monthly - Get monthly COGS data for charts
router.get('/monthly', async (req, res): Promise<any> => {
  try {
    const { year } = req.query;
    const targetYear = year ? parseInt(year as string) : getFinancialYear(new Date());
    
    // Get monthly data for the specified financial year
    const monthlyData = await prisma.cOGSRecord.groupBy({
      by: ['soldMonth'],
      where: {
        financialYear: targetYear
      },
      _sum: {
        costCents: true
      },
      _count: {
        id: true
      },
      orderBy: {
        soldMonth: 'asc'
      }
    });
    
    // Create a complete 12-month array with zero values for missing months
    // Financial year months: 1=July, 2=August, 3=September, ..., 12=June
    const fyMonthNames = [
      'July', 'August', 'September', 'October', 'November', 'December',
      'January', 'February', 'March', 'April', 'May', 'June'
    ];
    
    const completeMonthlyData = Array.from({ length: 12 }, (_, index) => {
      const fyMonth = index + 1; // Financial year month (1-12)
      const existingData = monthlyData.find(data => data.soldMonth === fyMonth);
      
      return {
        month: fyMonth,
        monthName: fyMonthNames[index],
        totalCostCents: existingData?._sum.costCents || 0,
        itemCount: existingData?._count.id || 0,
        averageCostCents: existingData?._count.id 
          ? Math.round((existingData._sum.costCents || 0) / existingData._count.id)
          : 0
      };
    });
    
    res.set('Cache-Control', 'public, max-age=900'); // 15 minutes cache
    
    res.json({
      success: true,
      data: {
        financialYear: targetYear,
        months: completeMonthlyData,
        yearTotal: {
          totalCostCents: completeMonthlyData.reduce((sum, month) => sum + month.totalCostCents, 0),
          totalItems: completeMonthlyData.reduce((sum, month) => sum + month.itemCount, 0)
        }
      }
    });
    
  } catch (error) {
    console.error('COGS monthly data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get monthly COGS data'
    });
  }
});

// GET /cogs/records - Get paginated COGS records
router.get('/records', async (req, res): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    
    const { year, month } = req.query;
    
    // Build where clause
    const where: any = {};
    if (year) {
      where.soldYear = parseInt(year as string);
    }
    if (month) {
      where.soldMonth = parseInt(month as string);
    }
    
    const [records, total] = await Promise.all([
      prisma.cOGSRecord.findMany({
        where,
        include: {
          item: {
            include: {
              isbnMaster: {
                select: {
                  title: true,
                  author: true,
                  imageUrl: true
                }
              }
            }
          }
        },
        orderBy: {
          soldDate: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.cOGSRecord.count({ where })
    ]);
    
    res.set('Cache-Control', 'public, max-age=300'); // 5 minutes cache
    
    res.json({
      success: true,
      data: {
        records,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
    
  } catch (error) {
    console.error('COGS records error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get COGS records'
    });
  }
});

// Internal function to create COGS record when item is sold
export const createCOGSRecord = async (itemId: number, soldDate: Date): Promise<void> => {
  try {
    // Get the item with its current cost
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: { 
        id: true, 
        costCents: true,
        currentStatus: true
      }
    });
    
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }
    
    if (item.currentStatus !== 'SOLD') {
      throw new Error(`Item ${itemId} is not marked as sold`);
    }
    
    // Check if COGS record already exists for this item
    const existingRecord = await prisma.cOGSRecord.findFirst({
      where: { itemId: itemId }
    });
    
    if (existingRecord) {
      console.log(`COGS record already exists for item ${itemId}`);
      return;
    }
    
    const soldMonth = getFinancialYearMonth(soldDate); // Financial year month (1-12)
    const soldYear = soldDate.getFullYear();
    const financialYear = getFinancialYear(soldDate);
    
    // Create COGS record
    await prisma.cOGSRecord.create({
      data: {
        itemId: itemId,
        costCents: item.costCents,
        soldDate: soldDate,
        soldMonth: soldMonth,
        soldYear: soldYear,
        financialYear: financialYear
      }
    });
    
    console.log(`COGS record created for item ${itemId}: $${(item.costCents / 100).toFixed(2)} on ${soldDate.toISOString().split('T')[0]}`);
    
  } catch (error) {
    console.error(`Failed to create COGS record for item ${itemId}:`, error);
    throw error;
  }
};

export default router;
