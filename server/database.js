const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('tradingbot', 'root', 'root', {
  host: 'localhost',
  dialect: 'mysql',
  port: 3306
});

module.exports = sequelize;
