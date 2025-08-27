import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

// GET /reports/listed-today - List all items moved to LISTED today
router.get('/listed-today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const listedToday = await prisma.itemStatusHistory.findMany({
      where: {
        toStatus: 'LISTED',
        changedAt: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        item: {
          include: {
            isbnMaster: true,
            listings: {
              where: { status: 'ACTIVE' },
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        }
      },
      orderBy: { changedAt: 'desc' }
    });

    const summary = {
      totalListed: listedToday.length,
      totalValue: listedToday.reduce((sum, record) => {
        const listing = record.item.listings[0];
        return sum + (listing?.priceCents || 0);
      }, 0),
      byChannel: listedToday.reduce((acc, record) => {
        const channel = record.channel || 'UNKNOWN';
        acc[channel] = (acc[channel] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    res.json({
      success: true,
      data: {
        items: listedToday,
        summary
      }
    });

  } catch (error) {
    console.error('Listed today report error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /reports/sold-today - List all items sold today
router.get('/sold-today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const soldToday = await prisma.itemStatusHistory.findMany({
      where: {
        toStatus: 'SOLD',
        changedAt: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        item: {
          include: {
            isbnMaster: true,
            listings: {
              where: { status: 'SOLD' },
              orderBy: { updatedAt: 'desc' },
              take: 1
            }
          }
        }
      },
      orderBy: { changedAt: 'desc' }
    });

    const summary = {
      totalSold: soldToday.length,
      totalRevenue: soldToday.reduce((sum, record) => {
        const listing = record.item.listings[0];
        return sum + (listing?.priceCents || 0);
      }, 0),
      byChannel: soldToday.reduce((acc, record) => {
        const channel = record.channel || 'UNKNOWN';
        acc[channel] = (acc[channel] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    res.json({
      success: true,
      data: {
        items: soldToday,
        summary
      }
    });

  } catch (error) {
    console.error('Sold today report error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /reports/inventory-summary - Overall inventory summary
router.get('/inventory-summary', async (req, res) => {
  try {
    const [
      totalItems,
      byStatus,
      byLocation,
      totalValue
    ] = await Promise.all([
      prisma.item.count(),
      prisma.item.groupBy({
        by: ['currentStatus'],
        _count: { id: true }
      }),
      prisma.item.groupBy({
        by: ['currentLocation'],
        _count: { id: true },
        where: { currentLocation: { not: null } }
      }),
      prisma.listing.aggregate({
        where: { status: 'ACTIVE' },
        _sum: { priceCents: true }
      })
    ]);

    const statusBreakdown = byStatus.reduce((acc, item) => {
      acc[item.currentStatus] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    const locationBreakdown = byLocation.reduce((acc, item) => {
      acc[item.currentLocation!] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      success: true,
      data: {
        totalItems,
        statusBreakdown,
        locationBreakdown,
        totalListedValue: totalValue._sum.priceCents || 0,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Inventory summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /reports/aging-stock - Items that have been in STORED status for a long time
router.get('/aging-stock', async (req, res) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string) || 30;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);

    const agingStock = await prisma.item.findMany({
      where: {
        currentStatus: 'STORED',
        updatedAt: {
          lt: cutoffDate
        }
      },
      include: {
        isbnMaster: true
      },
      orderBy: { updatedAt: 'asc' }
    });

    const summary = {
      totalItems: agingStock.length,
      averageAge: agingStock.reduce((sum, item) => {
        const ageInDays = Math.floor((Date.now() - item.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
        return sum + ageInDays;
      }, 0) / Math.max(agingStock.length, 1),
      byLocation: agingStock.reduce((acc, item) => {
        const location = item.currentLocation || 'UNLOCATED';
        acc[location] = (acc[location] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    res.json({
      success: true,
      data: {
        items: agingStock,
        summary
      }
    });

  } catch (error) {
    console.error('Aging stock report error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /reports/channel-performance - Performance by sales channel
router.get('/channel-performance', async (req, res) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string) || 30;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);

    const channelStats = await prisma.listing.groupBy({
      by: ['channel'],
      _count: { id: true },
      _sum: { priceCents: true },
      where: {
        createdAt: { gte: cutoffDate }
      }
    });

    const soldStats = await prisma.itemStatusHistory.groupBy({
      by: ['channel'],
      _count: { id: true },
      where: {
        toStatus: 'SOLD',
        changedAt: { gte: cutoffDate }
      }
    });

    const performance = channelStats.map(channel => {
      const sold = soldStats.find(s => s.channel === channel.channel);
      const soldCount = sold?._count.id || 0;
      const totalListed = channel._count.id;
      const conversionRate = totalListed > 0 ? (soldCount / totalListed) * 100 : 0;
      
      return {
        channel: channel.channel,
        totalListed,
        totalListedValue: channel._sum.priceCents || 0,
        soldCount,
        conversionRate: Math.round(conversionRate * 100) / 100
      };
    });

    res.json({
      success: true,
      data: {
        performance,
        period: `${daysNum} days`,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Channel performance error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
