// App.jsx
import React, { useEffect, useState, useRef } from "react";
import { Box, Typography, Paper, Grid, CssBaseline } from "@mui/material";
import { styled } from "@mui/material/styles";
import Chart from "chart.js/auto";

// 温度計SVGコンポーネント
const TempMeter = ({ temperature }) => {
  const capped = Math.min(Math.max(temperature, -10), 50);
  const height = ((capped + 10) / 60) * 230;
  const y = 250 - height;

  return (
    <svg width="100" height="300" viewBox="0 0 100 300" aria-label="温度計">
      <rect x="40" y="20" width="20" height="230" rx="10" ry="10" fill="#e0d7ff" />
      <rect x="40" y={y} width="20" height={height} rx="10" ry="10" fill="#6750a4" />
      <circle cx="50" cy="270" r="30" fill="#6750a4" />
      <circle cx="50" cy="270" r="15" fill="#e0d7ff" />
    </svg>
  );
};

// 半円ゲージコンポーネント
const SemiCircleGauge = ({ value, min, max, color, label }) => {
  const ratio = Math.min(Math.max((value - min) / (max - min), 0), 1);
  const angle = Math.PI * ratio;
  const startX = 10,
    startY = 90;
  const endX = 10 + 70 * Math.cos(angle);
  const endY = 90 - 70 * Math.sin(angle);
  const largeArcFlag = ratio > 0.5 ? 1 : 0;
  const d = `M ${startX} ${startY} A 70 70 0 ${largeArcFlag} 1 ${endX.toFixed(
    2
  )} ${endY.toFixed(2)}`;

  return (
    <Box textAlign="center" sx={{ color }}>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        {label}
      </Typography>
      <svg width={150} height={100} viewBox="0 0 150 100" aria-label={`${label}ゲージ`}>
        <path d="M10 90 A70 70 0 0 1 140 90" fill="none" stroke="#ccc" strokeWidth={16} />
        <path d={d} fill="none" stroke={color} strokeWidth={16} strokeLinecap="round" />
      </svg>
      <Typography variant="h4" fontWeight="bold" sx={{ mt: 1 }}>
        {value.toFixed(1)} {label === "湿度" ? "%" : label === "気圧" ? "hPa" : ""}
      </Typography>
    </Box>
  );
};

// styled Paper コンポーネント
const SensorCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: 20,
  boxShadow: theme.shadows[4],
  textAlign: "center",
}));

export default function App() {
  const [sensorData, setSensorData] = useState({ temperature: 0, humidity: 0, pressure: 0 });
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem("bme280_history");
    return saved ? JSON.parse(saved) : [];
  });
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // WebSocket接続とメッセージ受信
  useEffect(() => {
    import("https://chirimen.org/remote-connection/js/beta/RelayServer.js").then(({ RelayServer }) => {
      (async () => {
        const relay = RelayServer("chirimentest", "chirimenSocket", window.WebSocket, "https://chirimen.org");
        const channel = await relay.subscribe("chirimenLED_econanringo");
        console.log("WebSocketリレー接続成功");

        channel.onmessage = (message) => {
          try {
            const msg = JSON.parse(message.data);
            if (msg.type === "sensor_data" && msg.data) {
              const { temperature, humidity, pressure } = msg.data;

              setSensorData({ temperature, humidity, pressure });

              // 履歴更新
              setHistory((prev) => {
                const newData = [...prev, { time: Date.now(), temperature, humidity, pressure }];
                if (newData.length > 100) newData.shift();
                localStorage.setItem("bme280_history", JSON.stringify(newData));
                return newData;
              });
            }
          } catch (e) {
            console.warn("受信データ解析エラー", e);
          }
        };
      })();
    });
  }, []);

  // Chart.js 初期化・更新
  useEffect(() => {
    if (!chartRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.data.labels = history.map((d) => new Date(d.time).toLocaleTimeString());
      chartInstanceRef.current.data.datasets[0].data = history.map((d) => d.temperature);
      chartInstanceRef.current.data.datasets[1].data = history.map((d) => d.humidity);
      chartInstanceRef.current.data.datasets[2].data = history.map((d) => d.pressure);
      chartInstanceRef.current.update();
    } else {
      chartInstanceRef.current = new Chart(chartRef.current, {
        type: "line",
        data: {
          labels: history.map((d) => new Date(d.time).toLocaleTimeString()),
          datasets: [
            {
              label: "温度 (°C)",
              data: history.map((d) => d.temperature),
              borderColor: "#6750a4",
              backgroundColor: "rgba(103,80,164,0.2)",
              fill: true,
              tension: 0.3,
              yAxisID: "y",
            },
            {
              label: "湿度 (%)",
              data: history.map((d) => d.humidity),
              borderColor: "#0f62fe",
              backgroundColor: "rgba(15,98,254,0.2)",
              fill: true,
              tension: 0.3,
              yAxisID: "y1",
            },
            {
              label: "気圧 (hPa)",
              data: history.map((d) => d.pressure),
              borderColor: "#018786",
              backgroundColor: "rgba(1,135,134,0.2)",
              fill: true,
              tension: 0.3,
              yAxisID: "y2",
            },
          ],
        },
        options: {
          interaction: {
            mode: "index",
            intersect: false,
          },
          stacked: false,
          scales: {
            y: {
              type: "linear",
              position: "left",
              min: -10,
              max: 50,
              title: { display: true, text: "温度 (°C)" },
            },
            y1: {
              type: "linear",
              position: "right",
              min: 0,
              max: 100,
              grid: { drawOnChartArea: false },
              title: { display: true, text: "湿度 (%)" },
            },
            y2: {
              type: "linear",
              position: "right",
              offset: true,
              min: 950,
              max: 1100,
              grid: { drawOnChartArea: false },
              title: { display: true, text: "気圧 (hPa)" },
            },
            x: {
              title: { display: true, text: "時刻" },
            },
          },
        },
      });
    }
  }, [history]);

  return (
    <>
      <CssBaseline />
      <Box sx={{ p: 3, maxWidth: 1000, mx: "auto" }}>
        <Typography variant="h4" gutterBottom color="primary" fontWeight="bold" textAlign="center">
          BME280 センサーダッシュボード
        </Typography>

        <Grid container spacing={3} justifyContent="center">
          <Grid item xs={12} sm={4}>
            <SensorCard>
              <TempMeter temperature={sensorData.temperature} />
              <Typography variant="h5" mt={2}>
                {sensorData.temperature.toFixed(1)} °C
              </Typography>
            </SensorCard>
          </Grid>

          <Grid item xs={12} sm={4}>
            <SensorCard>
              <SemiCircleGauge value={sensorData.humidity} min={0} max={100} color="#0f62fe" label="湿度" />
            </SensorCard>
          </Grid>

          <Grid item xs={12} sm={4}>
            <SensorCard>
              <SemiCircleGauge value={sensorData.pressure} min={950} max={1100} color="#018786" label="気圧" />
            </SensorCard>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                過去データ変化グラフ (直近100件)
              </Typography>
              <canvas ref={chartRef} height={150} />
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </>
  );
}