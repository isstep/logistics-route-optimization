const express = require("express");
const cors = require("cors");
const winston = require("winston");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logistics.log" }),
  ],
});

const FUEL_PRICE = process.env.FUEL_PRICE || 2.20; // Цена за литр топлива
const FUEL_CONSUMPTION_RATE = 8; // Расход топлива на 100 км

const warehouses = [
  // Данные о складах
];

const customers = [
  // Данные о клиентах
];

const calculateDistanceByRoad = async (loc1, loc2) => {
  const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${loc1.lng},${loc1.lat};${loc2.lng},${loc2.lat}?overview=false`;
  try {
    const response = await axios.get(osrmUrl);
    const distanceInMeters = response.data.routes[0]?.distance;
    return distanceInMeters ? distanceInMeters / 1000 : null;
  } catch (error) {
    logger.error("Ошибка при получении данных маршрута:", error);
    return null; // Возвращаем null для обработки отсутствия данных
  }
};

const calculateFuelCost = (totalDistance) => {
  const fuelRequired = (totalDistance / 100) * FUEL_CONSUMPTION_RATE;
  return fuelRequired * FUEL_PRICE;
};

const buildRoute = async (order) => {
  const customer = customers.find((c) => c.id === order.id);
  if (!customer) {
    throw new Error(`Клиент с ID ${order.id} не найден.`);
  }

  let totalDistance = 0;
  const route = [];
  const visitedWarehouses = new Set();

  for (const food of order.foods) {
    const warehouse = warehouses.find(
      (w) => w.products[food.title] && w.products[food.title] >= food.quantity
    );

    if (!warehouse) {
      throw new Error(`Продукт "${food.title}" отсутствует в достаточном количестве.`);
    }

    if (!visitedWarehouses.has(warehouse.id)) {
      visitedWarehouses.add(warehouse.id);
    }
  }

  const warehouseList = Array.from(visitedWarehouses).map((id) =>
    warehouses.find((w) => w.id === id)
  );

  for (let i = 0; i < warehouseList.length; i++) {
    const fromWarehouse = warehouseList[i];
    const toLocation =
      i === warehouseList.length - 1 ? customer.location : warehouseList[i + 1].location;

    const distance = await calculateDistanceByRoad(fromWarehouse.location, toLocation);

    if (distance === null) {
      throw new Error(`Не удалось рассчитать расстояние между ${fromWarehouse.name} и клиентом.`);
    }

    totalDistance += distance;

    route.push({
      from: { name: fromWarehouse.name, location: fromWarehouse.location },
      to: {
        name: i === warehouseList.length - 1 ? customer.name : warehouseList[i + 1].name,
        location: toLocation,
      },
      distance,
    });
  }

  const fuelCost = calculateFuelCost(totalDistance);

  return { route, totalDistance, fuelCost };
};

app.post("/process-order", async (req, res) => {
  logger.info("Получен заказ:", req.body);

  try {
    const order = req.body[0];
    const result = await buildRoute(order);
    res.json(result);
  } catch (error) {
    logger.error("Ошибка при обработке заказа:", error.message);
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
