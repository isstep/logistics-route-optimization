const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const winston = require("winston");
const axios = require('axios');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logistics.log" }),
  ],
});

const warehouses = [
  {
    id: 1,
    name: "Склад 1",
    location: { lat: 53.9045, lng: 27.559 },
    products: {
      "Кофе молотый «Dallmayr» Prodomo": 10,
      "Вафли «Спартак» Черноморские": 20,
      "Крекер «Белогорье» Cristo Twisto": 15,
    },
  },
  {
    id: 2,
    name: "Склад 2",
    location: { lat: 53.906, lng: 27.545 },
    products: {
      "Мармелад жевательный «Бон Пари»": 30,
      "Напиток газированный «Coca-Cola»": 50,
    },
  },
  {
    id: 3,
    name: "Склад 3",
    location: { lat: 53.91, lng: 27.557 },
    products: {
      "Набор конфет «Raffaello»": 20,
      "Напиток газированный «Fanta»": 40,
    },
  },
];

const customers = [
  { id: 1, name: "Клиент 1", location: { lat: 53.901, lng: 27.558 } },
];


const calculateDistanceByRoad = async (loc1, loc2) => {
  const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${loc1.lng},${loc1.lat};${loc2.lng},${loc2.lat}?overview=false`;
  try {
      const response = await axios.get(osrmUrl);
      const distanceInMeters = response.data.routes[0].distance;
      return distanceInMeters / 1000; 
  } catch (error) {
      console.error("Ошибка при получении данных маршрута:", error);
      return calculateDistance(loc1, loc2); 
  }
};


const calculateFuelCost = (totalDistance) => {
  const fuelConsumptionRate = 8; 
  const fuelPrice = 2.20;

  const fuelRequired = (totalDistance / 100) * fuelConsumptionRate;


  const fuelCost = fuelRequired * fuelPrice;
  return fuelCost;
};


const buildRoute = async (order) => {
  const customer = customers.find(c => c.id === order.id);
  let totalDistance = 0;
  const route = [];
  const warehousesInOrder = []; 
  for (const food of order.foods) {
      const warehouse = warehouses.find(w => w.products[food.title]);
      if (warehouse && !warehousesInOrder.includes(warehouse)) {
          warehousesInOrder.push(warehouse); 
      }
  }
  for (let i = 0; i < warehousesInOrder.length; i++) {
      const fromWarehouse = warehousesInOrder[i];
      const toLocation = i === warehousesInOrder.length - 1 ? customer.location : warehousesInOrder[i + 1].location;
      const distance = await calculateDistanceByRoad(fromWarehouse.location, toLocation);
      totalDistance += distance;
      route.push({
          from: { name: fromWarehouse.name, location: fromWarehouse.location },
          to: { name: i === warehousesInOrder.length - 1 ? customer.name : warehousesInOrder[i + 1].name, location: toLocation },
          distance
      });
  }

  const fuelCost = calculateFuelCost(totalDistance);
  return { route, totalDistance, fuelCost };
};

app.post("/process-order", async (req, res) => {
  logger.info("Полученный заказ:", req.body);
  const order = req.body[0];
  const result = await buildRoute(order); 
  res.json(result); 
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
