import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Helper function to calculate financial year
const getFinancialYear = (date: Date): number => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // getMonth() returns 0-11
  
  // If the month is July (7) or later, it's the next financial year
  // If the month is before July, it's the current financial year
  return month >= 7 ? year + 1 : year;
};

// Helper function to get financial year month (July=1, August=2, etc.)
const getFinancialYearMonth = (date: Date): number => {
  const month = date.getMonth() + 1; // getMonth() returns 0-11
  return month >= 7 ? month - 6 : month + 6;
};

// GET /sales/summary - Overall sales summary
router.get('/summary', async (req, res) => {
  try {
    const now = new Date();
    const currentFY = getFinancialYear(now);
    const previousFY = currentFY - 1;

    // Get all-time sales (SOLD status only)
    const allTimeSales = await prisma.item.aggregate({
      where: { currentStatus: 'SOLD' },
      _count: { id: true },
    });

    // Get current financial year sales
    const currentFYStart = new Date(currentFY - 1, 6, 1); // July 1st of previous calendar year
    const currentFYEnd = new Date(currentFY, 5, 30, 23, 59, 59); // June 30th of current calendar year

    const currentFYSales = await prisma.item.aggregate({
      where: {
        currentStatus: 'SOLD',
        soldDate: {
          gte: currentFYStart,
          lte: currentFYEnd,
        },
      },
      _count: { id: true },
    });

    // Get previous financial year sales for YoY comparison
    const previousFYStart = new Date(previousFY - 1, 6, 1);
    const previousFYEnd = new Date(previousFY, 5, 30, 23, 59, 59);

    const previousFYSales = await prisma.item.aggregate({
      where: {
        currentStatus: 'SOLD',
        soldDate: {
          gte: previousFYStart,
          lte: previousFYEnd,
        },
      },
      _count: { id: true },
    });



    // Get current month sales
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const currentMonthSales = await prisma.item.aggregate({
      where: {
        currentStatus: 'SOLD',
        soldDate: {
          gte: currentMonthStart,
          lte: currentMonthEnd,
        },
      },
      _count: { id: true },
    });

    // Calculate YoY growth based on item count, not revenue
    const currentItemCount = currentFYSales._count.id || 0;
    const previousItemCount = previousFYSales._count.id || 0;
    const itemYoyGrowthPercent = previousItemCount > 0 
      ? ((currentItemCount - previousItemCount) / previousItemCount) * 100 
      : currentItemCount > 0 ? 100 : 0;

    res.set('Cache-Control', 'public, max-age=300'); // 5 minutes cache
    res.json({
      success: true,
      data: {
        allTime: {
          totalItemsSold: allTimeSales._count.id || 0,
        },
        currentFinancialYear: {
          financialYear: currentFY,
          totalItemsSold: currentFYSales._count.id || 0,
          yoyGrowthPercent: parseFloat(itemYoyGrowthPercent.toFixed(1)),
        },
        currentMonth: {
          month: now.toLocaleString('default', { month: 'long' }),
          year: now.getFullYear(),
          totalItemsSold: currentMonthSales._count.id || 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching sales summary:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /sales/monthly?year=YYYY - Monthly sales data for charts
router.get('/monthly', async (req, res) => {
  try {
    const year = parseInt(req.query.year as string) || getFinancialYear(new Date());
    
    // Financial year starts July 1st of previous calendar year
    const fyStart = new Date(year - 1, 6, 1); // July 1st
    const fyEnd = new Date(year, 5, 30, 23, 59, 59); // June 30th

    // Get monthly aggregated sales data
    const monthlySales = await prisma.item.groupBy({
      by: ['soldYear', 'soldMonth'],
      where: {
        currentStatus: 'SOLD',
        soldDate: {
          gte: fyStart,
          lte: fyEnd,
        },
      },
      _count: { id: true },
      orderBy: [
        { soldYear: 'asc' },
        { soldMonth: 'asc' },
      ],
    });

    // Convert to financial year months
    const fyMonthNames = ['July', 'August', 'September', 'October', 'November', 'December',
                         'January', 'February', 'March', 'April', 'May', 'June'];
    
    // Initialize all months with zero
    const monthlyData = fyMonthNames.map((monthName, index) => ({
      month: index + 1, // Financial year month (1-12)
      monthName,
      totalItemsSold: 0,
    }));

    // Fill in actual data
    monthlySales.forEach(sale => {
      if (sale.soldMonth && sale.soldYear) {
        // Convert calendar month to financial year month
        const calendarMonth = sale.soldMonth;
        const fyMonth = calendarMonth >= 7 ? calendarMonth - 6 : calendarMonth + 6;
        
        if (fyMonth >= 1 && fyMonth <= 12) {
          const monthIndex = fyMonth - 1;
          monthlyData[monthIndex].totalItemsSold = sale._count.id || 0;
        }
      }
    });

    res.set('Cache-Control', 'public, max-age=900'); // 15 minutes cache
    res.json({
      success: true,
      data: {
        financialYear: year,
        months: monthlyData,
        totalItemsSold: monthlyData.reduce((sum, month) => sum + month.totalItemsSold, 0),
      },
    });
  } catch (error) {
    console.error('Error fetching monthly sales:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /sales/recent - Recent sales for the timeline bar
router.get('/recent', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const recentSales = await prisma.item.findMany({
      where: {
        currentStatus: 'SOLD',
        soldDate: {
          gte: startDate,
        },
      },
      select: {
        id: true,
        isbn: true,
        soldDate: true,
        createdAt: true,
        isbnMaster: {
          select: {
            title: true,
            author: true,
          },
        },
      },
      orderBy: { soldDate: 'desc' },
      take: limit,
    });

    // Group by day for the timeline
    const salesByDay: { [key: string]: { count: number } } = {};
    const today = new Date();
    
    // Initialize all days in range with zero
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayKey = date.toISOString().split('T')[0];
      salesByDay[dayKey] = { count: 0 };
    }

    // Fill in actual sales data
    recentSales.forEach(sale => {
      if (sale.soldDate) {
        const dayKey = sale.soldDate.toISOString().split('T')[0];
        if (salesByDay[dayKey]) {
          salesByDay[dayKey].count += 1;
        }
      }
    });

    // Convert to array format for charts
    const timelineData = Object.entries(salesByDay)
      .map(([date, data]) => ({
        date,
        count: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Transform the data to flatten isbnMaster fields
    const transformedRecentSales = recentSales.map(sale => ({
      id: sale.id,
      isbn: sale.isbn || '',
      title: sale.isbnMaster?.title || 'Unknown Title',
      author: sale.isbnMaster?.author || 'Unknown Author',
      soldDate: sale.soldDate ? sale.soldDate.toISOString() : '',
    }));

    res.set('Cache-Control', 'public, max-age=180'); // 3 minutes cache
    res.json({
      success: true,
      data: {
        recentSales: transformedRecentSales,
        timeline: timelineData,
        totalRecentCount: recentSales.length,
      },
    });
  } catch (error) {
    console.error('Error fetching recent sales:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /sales/records - Paginated sales records for detailed view
router.get('/records', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limitNum = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limitNum;

    const [salesRecords, totalCount] = await Promise.all([
      prisma.item.findMany({
        where: { currentStatus: 'SOLD' },
        select: {
          id: true,
          isbn: true,
          priceCents: true,
          costCents: true,
          soldDate: true,
          isbnMaster: {
            select: {
              title: true,
              author: true,
            }
          },
          createdAt: true,
          currentLocation: true,
        },
        orderBy: { soldDate: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.item.count({
        where: { currentStatus: 'SOLD' },
      }),
    ]);

    // Calculate profit margins and flatten isbnMaster data
    const recordsWithMargins = salesRecords.map(record => ({
      ...record,
      title: record.isbnMaster?.title || 'Unknown Title',
      author: record.isbnMaster?.author || 'Unknown Author',
      profitCents: (record.priceCents || 0) - (record.costCents || 0),
      marginPercent: record.priceCents > 0 
        ? (((record.priceCents || 0) - (record.costCents || 0)) / (record.priceCents || 1)) * 100
        : 0,
    }));

    res.set('Cache-Control', 'public, max-age=60'); // 1 minute cache
    res.json({
      success: true,
      data: {
        records: recordsWithMargins,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limitNum),
          totalCount,
          hasNextPage: skip + limitNum < totalCount,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching sales records:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
