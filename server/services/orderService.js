const { Op } = require('sequelize'); // <-- bắt buộc phải có
const Order = require('../model/Order'); // <-- đúng path tới Sequelize model của bạn
const isEmpty = (val) =>
  val === undefined ||
  val === null ||
  (typeof val === 'string' && val.trim() === '') ||
  (Array.isArray(val) && val.length === 0);

const allowedSortFields = ['update_time', 'createdAt', 'price']; // tùy chỉnh theo DB
const allowedSortOrders = ['ASC', 'DESC'];

async function getAllOrders({
  page = 1,
  limit = 20,
  sortBy = 'update_time',
  sortOrder = 'DESC',
  orderId,
  symbol,
  status,
  clientOrderId,
  price,
  avgPrice,
  origQty,
  executedQty,
  cumQty,
  cumQuote,
  timeInForce,
  type,
  reduceOnly,
  closePosition,
  side,
  sideIn,
  positionSide,
  stopPrice,
  workingType,
  priceProtect,
  origType,
  priceMatch,
  selfTradePreventionMode,
  goodTillDate,
  createdAt,
  binanceAccount,
  indicatorCall,
  description,
  fromTime,
  toTime,
  fromCreated,
  toCreated,
  keyword
} = {}) {
  try {
    page = Number.isInteger(page) && page > 0 ? page : 1;
    limit = Number.isInteger(limit) && limit > 0 ? limit : 20;

    sortBy = allowedSortFields.includes(sortBy) ? sortBy : 'update_time';
    sortOrder = allowedSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    const offset = (page - 1) * limit;
    const where = {};

    if (!isEmpty(orderId)) where.orderId = orderId;
    if (!isEmpty(symbol)) where.symbol = symbol.toUpperCase();
    if (!isEmpty(status)) where.status = status;
    if (!isEmpty(clientOrderId)) where.clientOrderId = clientOrderId;
    if (!isEmpty(price)) where.price = price;
    if (!isEmpty(avgPrice)) where.avgPrice = avgPrice;
    if (!isEmpty(origQty)) where.origQty = origQty;
    if (!isEmpty(executedQty)) where.executedQty = executedQty;
    if (!isEmpty(cumQty)) where.cumQty = cumQty;
    if (!isEmpty(cumQuote)) where.cumQuote = cumQuote;
    if (!isEmpty(timeInForce)) where.timeInForce = timeInForce;
    if (!isEmpty(type)) where.type = type.toUpperCase();
    if (reduceOnly !== undefined) where.reduceOnly = reduceOnly;
    if (closePosition !== undefined) where.closePosition = closePosition;
    if (!isEmpty(side)) where.side = side.toUpperCase();
    if (Array.isArray(sideIn) && sideIn.length > 0) {
      where.side = { [Op.in]: sideIn.map((s) => s.toUpperCase()) };
    }
    if (!isEmpty(positionSide)) where.positionSide = positionSide.toUpperCase();
    if (!isEmpty(stopPrice)) where.stopPrice = stopPrice;
    if (!isEmpty(workingType)) where.workingType = workingType;
    if (priceProtect !== undefined) where.priceProtect = priceProtect;
    if (!isEmpty(origType)) where.origType = origType;
    if (!isEmpty(priceMatch)) where.priceMatch = priceMatch;
    if (!isEmpty(selfTradePreventionMode)) where.selfTradePreventionMode = selfTradePreventionMode;
    if (!isEmpty(goodTillDate)) where.goodTillDate = goodTillDate;
    if (!isEmpty(binanceAccount)) where.binanceAccount = binanceAccount;
    if (!isEmpty(indicatorCall)) where.indicatorCall = indicatorCall;

    if (!isEmpty(description)) {
      where.description = { [Op.iLike]: `%${description}%` };
    }

    if (!isEmpty(keyword)) {
      where[Op.or] = [
        { symbol: { [Op.iLike]: `%${keyword}%` } },
        { orderId: { [Op.iLike]: `%${keyword}%` } },
        { clientOrderId: { [Op.iLike]: `%${keyword}%` } },
        { description: { [Op.iLike]: `%${keyword}%` } }
      ];
    }

    if (fromTime || toTime) {
      where.update_time = {};
      if (fromTime) where.update_time[Op.gte] = new Date(fromTime);
      if (toTime) where.update_time[Op.lte] = new Date(toTime);
    }

    if (!isEmpty(fromCreated) || !isEmpty(toCreated)) {
      where.createdAt = {};
      if (!isEmpty(fromCreated)) where.createdAt[Op.gte] = new Date(fromCreated);
      if (!isEmpty(toCreated)) where.createdAt[Op.lte] = new Date(toCreated);
    }

    const { count, rows } = await Order.findAndCountAll({
      where,
      offset,
      limit,
      order: [[sortBy, sortOrder]]
    });

    return {
      total: count,
      totalPages: Math.ceil(count / limit),
      page,
      limit,
      data: rows.map((o) => o.toJSON())
    };
  } catch (err) {
    console.error('❌ Lỗi khi lấy danh sách order:', err);
    return { total: 0, totalPages: 0, page, limit, data: [] };
  }
}

module.exports = { getAllOrders };
