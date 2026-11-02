import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { Asset, Candle, marketData } from "../lib/market";
import { useTheme } from "../lib/theme";
import {
  AppButton,
  Chip,
  ErrorState,
  Label,
  LoadingState,
  Row,
} from "./design";
export function TradingChart({
  asset,
  small = false,
}: {
  asset: Asset;
  small?: boolean;
}) {
  const { colors } = useTheme();
  const [candles, setCandles] = useState<Candle[]>([]);
  const [frame, setFrame] = useState("1h");
  const [mode, setMode] = useState("Candles");
  const [zoom, setZoom] = useState(64);
  const [offset, setOffset] = useState(0);
  const [cross, setCross] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    let active = true;
    marketData
      .candles(asset, frame)
      .then((data) => {
        if (active) {
          setCandles(data);
          setLoading(false);
          setCross(null);
          setOffset(0);
        }
      })
      .catch(() => {
        if (active) {
          setError(
            "Chart unavailable. Try loading the simulated series again.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [asset, frame, retry]);
  const data = useMemo(
    () =>
      candles.slice(
        Math.max(0, candles.length - zoom - offset),
        candles.length - offset,
      ),
    [candles, zoom, offset],
  );
  const h = small ? 180 : 300;
  const plotW = Math.max(200, width - 70);
  const low = data.length ? Math.min(...data.map((d) => d.low)) * 0.9997 : 0;
  const high = data.length ? Math.max(...data.map((d) => d.high)) * 1.0003 : 1;
  const y = (p: number) => 15 + ((high - p) / (high - low)) * (h - 45);
  const x = (i: number) =>
    10 + (i / Math.max(1, data.length - 1)) * (plotW - 20);
  const path = data
    .map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.close)}`)
    .join(" ");
  const selected =
    cross === null
      ? undefined
      : data[
          Math.min(
            data.length - 1,
            Math.max(0, Math.round((cross / plotW) * (data.length - 1))),
          )
        ];
  return (
    <View style={{ gap: 14 }}>
      {!small && (
        <>
          <Row style={{ flexWrap: "wrap" }}>
            <Row style={{ gap: 4, flexWrap: "wrap" }}>
              {["1m", "5m", "15m", "1h", "4h", "1D"].map((f) => (
                <Chip
                  key={f}
                  label={f}
                  selected={f === frame}
                  onPress={() => {
                    if (f === frame) return;
                    setLoading(true);
                    setError("");
                    setFrame(f);
                  }}
                />
              ))}
            </Row>
            <Row style={{ gap: 5 }}>
              {["Candles", "Line"].map((m) => (
                <Chip
                  key={m}
                  label={m}
                  selected={mode === m}
                  onPress={() => setMode(m)}
                />
              ))}
            </Row>
          </Row>
          <Row>
            <Label muted size={11}>
              {selected
                ? `O ${selected.open.toFixed(asset.precision)}  H ${selected.high.toFixed(asset.precision)}  L ${selected.low.toFixed(asset.precision)}  C ${selected.close.toFixed(asset.precision)}`
                : "Touch or drag to inspect · historical simulated series"}
            </Label>
          </Row>
        </>
      )}
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: h }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => setCross(e.nativeEvent.locationX)}
        onResponderMove={(e) => setCross(e.nativeEvent.locationX)}
        accessibilityLabel={`${asset.symbol} simulated ${mode} chart. Use the controls to zoom and pan.`}
      >
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState
            message={error}
            retry={() => {
              setLoading(true);
              setError("");
              setRetry(retry + 1);
            }}
          />
        ) : !data.length ? (
          <Label muted>No chart data for this asset.</Label>
        ) : (
          <Svg width="100%" height={h} viewBox={`0 0 ${width} ${h}`}>
            <Defs>
              <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#00E676" stopOpacity="0.18" />
                <Stop offset="1" stopColor="#00E676" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            {Array.from({ length: 5 }, (_, i) => {
              const value = low + ((high - low) * i) / 4;
              return (
                <React.Fragment key={i}>
                  <Line
                    x1="0"
                    x2={plotW}
                    y1={y(value)}
                    y2={y(value)}
                    stroke={colors.border}
                    strokeDasharray="3 5"
                  />
                  <SvgText
                    x={plotW + 5}
                    y={y(value) + 4}
                    fill={colors.sub}
                    fontSize="10"
                  >
                    {value.toFixed(asset.precision)}
                  </SvgText>
                </React.Fragment>
              );
            })}
            {mode === "Line" || small ? (
              <>
                <Path
                  d={`${path} L${x(data.length - 1)},${h - 25} L10,${h - 25} Z`}
                  fill="url(#area)"
                />
                <Path d={path} stroke="#00B76A" strokeWidth="2" fill="none" />
              </>
            ) : (
              data.map((d, i) => (
                <React.Fragment key={i}>
                  <Line
                    x1={x(i)}
                    x2={x(i)}
                    y1={y(d.high)}
                    y2={y(d.low)}
                    stroke={d.close >= d.open ? "#0AAB77" : "#C43549"}
                  />
                  <Rect
                    x={x(i) - (plotW / data.length) * 0.28}
                    y={Math.min(y(d.open), y(d.close))}
                    width={Math.max(2, (plotW / data.length) * 0.56)}
                    height={Math.max(1.5, Math.abs(y(d.close) - y(d.open)))}
                    fill={d.close >= d.open ? "#0AAB77" : "#C43549"}
                    rx="1"
                  />
                </React.Fragment>
              ))
            )}
            {selected && cross !== null && (
              <>
                <Line
                  x1={Math.min(plotW, cross)}
                  x2={Math.min(plotW, cross)}
                  y1="0"
                  y2={h - 25}
                  stroke={colors.sub}
                  strokeDasharray="4 4"
                />
                <Line
                  x1="0"
                  x2={plotW}
                  y1={y(selected.close)}
                  y2={y(selected.close)}
                  stroke={colors.sub}
                  strokeDasharray="4 4"
                />
                <Circle
                  cx={Math.min(plotW, cross)}
                  cy={y(selected.close)}
                  r="4"
                  fill="#00E676"
                />
              </>
            )}
            {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
              <SvgText
                key={i}
                x={x(Math.floor((data.length - 1) * f))}
                y={h - 4}
                fill={colors.sub}
                fontSize="10"
                textAnchor={i === 0 ? "start" : "middle"}
              >
                {new Date(data[Math.floor((data.length - 1) * f)].time)
                  .toISOString()
                  .slice(frame === "1D" ? 5 : 11, frame === "1D" ? 10 : 16)}
              </SvgText>
            ))}
          </Svg>
        )}
      </View>
      {!small && (
        <Row style={{ flexWrap: "wrap" }}>
          <Label muted size={10}>
            Demo feed · 30 OCT 2026 · UTC
          </Label>
          <Row style={{ gap: 5 }}>
            <AppButton
              compact
              variant="ghost"
              label="←"
              onPress={() => {
                setOffset(Math.min(candles.length - zoom, offset + 8));
                setCross(null);
              }}
              disabled={offset >= candles.length - zoom}
            />
            <AppButton
              compact
              variant="ghost"
              label="−"
              onPress={() => {
                setZoom(Math.min(100, zoom + 12));
                setOffset(0);
              }}
              disabled={zoom >= 100}
            />
            <AppButton
              compact
              variant="ghost"
              label="+"
              onPress={() => {
                setZoom(Math.max(24, zoom - 12));
                setOffset(0);
              }}
              disabled={zoom <= 24}
            />
            <AppButton
              compact
              variant="ghost"
              label="→"
              onPress={() => {
                setOffset(Math.max(0, offset - 8));
                setCross(null);
              }}
              disabled={!offset}
            />
          </Row>
        </Row>
      )}
    </View>
  );
}
