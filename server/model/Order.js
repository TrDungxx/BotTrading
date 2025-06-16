const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Order = sequelize.define('Order', {
  symbol: DataTypes.STRING,
  type: DataTypes.STRING,
  side: DataTypes.STRING,
  price: DataTypes.DECIMAL,
  createdAt: DataTypes.DATE,
}, {
  tableName: 'orders',
  timestamps: false
});

module.exports = Order;
