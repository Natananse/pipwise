import React, { useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import {
  Badge,
  Chip,
  GlassCard,
  Label,
  Page,
  Row,
} from "../../components/design";
import { TradingChart } from "../../components/TradingChart";
import { assets, money } from "../../lib/market";
import { summary } from "../../lib/simulator";
import { useWorkspace } from "../../lib/workspace";
export default function Analyse() {
  const { t, wallet } = useWorkspace();
  const [asset, setAsset] = useState(assets[0]);
  const stats = summary(wallet);
  const wide = useWindowDimensions().width > 850;
  const wins = wallet.history.filter((p) => (p.pnl || 0) > 0).length;
  return (
    <Page
      title={t("Market perspective.")}
      subtitle="OBSERVE. QUESTION. UNDERSTAND."
    >
      <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
        {assets.map((a) => (
          <Chip
            key={a.symbol}
            label={a.symbol}
            selected={asset.symbol === a.symbol}
            onPress={() => setAsset(a)}
          />
        ))}
      </ScrollView>
      <View style={{ flexDirection: wide ? "row" : "column", gap: 20 }}>
        <GlassCard style={{ flex: 2 }}>
          <Row>
            <Label bold size={21}>
              {asset.symbol} overview
            </Label>
            <Badge>SIMULATED</Badge>
          </Row>
          <TradingChart asset={asset} />
        </GlassCard>
        <GlassCard style={{ flex: 1 }}>
          <Label bold size={20}>
            Reading the market
          </Label>
          <Badge>EDUCATIONAL OBSERVATION</Badge>
          <Label size={22} bold>
            {asset.change > 0
              ? "An upward sample session"
              : "A softer sample session"}
          </Label>
          <Label muted>
            The example session shows a {Math.abs(asset.change)}%{" "}
            {asset.change > 0 ? "rise" : "decline"}. This describes the sample,
            not a forecast or a trading recommendation.
          </Label>
          <Label bold>Before taking a view</Label>
          <Label muted>
            Compare timeframes. Identify what would invalidate your idea. Decide
            your risk before opening a position.
          </Label>
          <Label muted size={12}>
            Live indicators and external market research are not connected. No
            buy or sell signals are generated.
          </Label>
        </GlassCard>
      </View>
      <Label size={22} bold>
        Your practice, in perspective
      </Label>
      <View style={{ flexDirection: wide ? "row" : "column", gap: 16 }}>
        {[
          ["Account equity", money(stats.equity)],
          ["Realized P/L", money(stats.realized)],
          [
            "Win rate",
            wallet.history.length
              ? `${((wins / wallet.history.length) * 100).toFixed(0)}%`
              : "No closed trades",
          ],
          ["Completed trades", String(wallet.history.length)],
        ].map(([label, value]) => (
          <GlassCard key={label} style={{ flex: 1 }}>
            <Label muted size={12}>
              {label}
            </Label>
            <Label size={24} bold>
              {value}
            </Label>
          </GlassCard>
        ))}
      </View>
      <GlassCard>
        <Label bold size={20}>
          Equity journal
        </Label>
        <Label muted>
          {wallet.history.length
            ? "Closed trade results in chronological order, net of fees. Open position fees are reflected in current equity."
            : "Your curve starts at $10,000. Close your first virtual position to begin your equity journal."}
        </Label>
        <EquityCurve
          values={[
            10000,
            ...wallet.history
              .slice()
              .reverse()
              .map(
                (_, i, history) =>
                  10000 +
                  history.slice(0, i + 1).reduce((s, p) => s + (p.pnl || 0), 0),
              ),
          ]}
        />
      </GlassCard>
    </Page>
  );
}
import Svg, { Line, Path, Text as SvgText } from "react-native-svg";
function EquityCurve({ values }: { values: number[] }) {
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const path = values
    .map(
      (v, i) =>
        `${i ? "L" : "M"}${20 + (i / Math.max(1, values.length - 1)) * 650},${130 - ((v - min) / (max - min)) * 110}`,
    )
    .join(" ");
  return (
    <Svg height={170} width="100%" viewBox="0 0 740 170">
      <Line x1="20" x2="670" y1="130" y2="130" stroke="#E6EBEF" />
      <Path
        d={values.length === 1 ? "M20,75 L670,75" : path}
        stroke="#00B76A"
        strokeWidth="3"
        fill="none"
      />
      <SvgText x="20" y="160" fill="#8293A3" fontSize="12">
        Start · $10,000
      </SvgText>
      <SvgText x="600" y="160" fill="#8293A3" fontSize="12">
        {values.length - 1} trades
      </SvgText>
    </Svg>
  );
}
