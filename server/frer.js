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

const FUEL_PRICE = process.env.FUEL_PRICE || 2.20;
const FUEL_CONSUMPTION_RATE = 8; 


const calculateDistanceByRoad = async (loc1, loc2) => {
  const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${loc1.lon},${loc1.lat};${loc2.lon},${loc2.lat}?overview=full&geometries=geojson`;
  try {
    const response = await axios.get(osrmUrl);
    const route = response.data.routes[0];
    if (!route) {
      throw new Error("Маршрут не найден.");
    }
    return {
      distance: route.distance / 1000, 
      geometry: route.geometry.coordinates, 
    };
  } catch (error) {
    logger.error("Ошибка при получении данных маршрута:", error);
    return { distance: null, geometry: null };
  }
};


const calculateFuelCost = (totalDistance) => {
  const fuelRequired = (totalDistance / 100) * FUEL_CONSUMPTION_RATE;
  return fuelRequired * FUEL_PRICE;
};


app.post("/process-order", async (req, res) => {
  const { points } = req.body;
  let totalDistance = 0;
  const route = [];
  const geometry = [];


  for (let i = 0; i < points.length - 1; i++) {
    const fromPoint = points[i];
    const toPoint = points[i + 1];

    const { distance, geometry: routeGeometry } = await calculateDistanceByRoad(fromPoint, toPoint);

    if (distance === null) {
      return res.status(400).json({ error: `Не удалось рассчитать расстояние между точками.` });
    }

    totalDistance += distance;
    geometry.push(...routeGeometry);

    route.push({
      from: { name: `Точка ${i + 1}`, location: fromPoint },
      to: { name: `Точка ${i + 2}`, location: toPoint },
      distance,
    });
  }

  const fuelCost = calculateFuelCost(totalDistance);

  res.json({ route, totalDistance, fuelCost, geometry });
});

app.listen(3000, () => {
  console.log("Сервер запущен на порту 3000");
});
