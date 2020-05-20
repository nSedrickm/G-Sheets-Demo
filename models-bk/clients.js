
"use strict";

module.exports = function(sequelize, DataTypes) {
  var Clients = sequelize.define('Clients', {
    ClientName: {type: DataTypes.STRING, allowNull: false},
    Token: {type: DataTypes.STRING, allowNull: false},
    Date: {type: DataTypes.STRING, allowNull: false},

  });

  return Clients;
};
