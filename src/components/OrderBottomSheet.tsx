import React, { useRef, useState } from "react";
import { View } from "react-native";
import { Asset, money, price, usdNotional } from "../lib/market";
import { Direction, feeRate, Position } from "../lib/simulator";
import { useDemoMarket } from '../lib/demoMarketProvider';
import { useWorkspace } from "../lib/workspace";
import { useTheme } from "../lib/theme";
import { estimateOrderRisk } from '../lib/orderRisk';
import { RiskRing } from './RiskRing';
import {
  AppButton,
  AppInput,
  Badge,
  ErrorState,
  GlassCard,
  Icon,
  Label,
  Row,
  Sheet,
} from "./design";
export function OrderBottomSheet({
  asset,
  direction,
  onClose,
  embedded = false,
  onInputFocus,
  onInputBlur,
}: {
  asset: Asset;
  direction: Direction | null;
  onClose: () => void;
  embedded?: boolean;
  onInputFocus?: (offset: number) => void;
  onInputBlur?: () => void;
}) {
  const { wallet, trade } = useWorkspace();
  const { snapshot, ready } = useDemoMarket();
  const { colors } = useTheme();
  const [quantity, setQuantity] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [filled, setFilled] = useState<Position | null>(null);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const fieldOffsets = useRef({ quantity: 0, sl: 0, tp: 0 });
  const q = Number(quantity);
  const value = usdNotional(asset, q);
  const unitValue = usdNotional(asset, 1);
  const fee = value * feeRate;
  const close = () => {
    setSuccess(false);
    setFilled(null);
    setReview(false);
    setError("");
    if (!ready) return setError('Loading saved simulated prices. Please wait.');
    setQuantity("");
    setSl("");
    setTp("");
    onClose();
  };
  const submit = () => {
    setError("");
    if (!q || !Number.isFinite(q) || q <= 0)
      return setError("Enter a valid positive quantity.");
    if (value + fee > wallet.cash)
      return setError("Insufficient virtual balance.");
    if (!review) return setReview(true);
    setBusy(true);
    try {
      const position = trade(
        asset,
        direction!,
        q,
        sl ? Number(sl) : undefined,
        tp ? Number(tp) : undefined,
      );
      setFilled(position);
      setSuccess(true);
    } catch (e) {
      setError((e as Error).message);
      setReview(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <OrderSurface
      embedded={embedded}
      visible={direction !== null}
      onClose={close}
      title={
        success
          ? "Order placed"
          : `${direction === "buy" ? "Buy" : "Sell"} ${asset.symbol}`
      }
    >
      {success ? (
        <>
          <Icon name="checkmark-circle" size={54} color={colors.sheetUp} />
          <Label size={23} bold>
            Your practice is paying off.
          </Label>
          <Label muted>
            {quantity} units of {asset.symbol}. Your simulated position is now
            in your portfolio.
          </Label>
          {filled && <Label bold>Filled at {filled.entry.toFixed(asset.precision)} {asset.symbol.split('/')[1]} · simulated</Label>}
          <AppButton label="Back to workspace" onPress={close} />
        </>
      ) : (
        <>
          {!embedded && <><Badge>VIRTUAL ORDER · NO REAL MONEY</Badge>
          <Row>
            <Label muted>Current simulated price</Label>
            <Label size={24} bold>
              {price(asset)} {asset.symbol.split('/')[1]}
            </Label>
          </Row>
          <Label muted size={11}>SIMULATED · {new Date(snapshot.asOf).toISOString().slice(11, 19)} UTC</Label></>}
          {review ? (
            <GlassCard>
              <Label bold>Review your order</Label>
              <Label>
                {direction?.toUpperCase()} · {quantity} units · {asset.symbol}
              </Label>
              <Label muted>
                Stop loss: {sl || "None"} · Take profit: {tp || "None"}
              </Label>
              <Label muted size={12}>
                The demo price can move during review. Your order fills at the
                current simulated quote when confirmed. Protective levels are
                saved as practice targets; automated execution is not connected.
              </Label>
            </GlassCard>
          ) : (
            <>
              <View onLayout={event => { fieldOffsets.current.quantity = event.nativeEvent.layout.y; }}><AppInput
                label="Quantity (units)"
                keyboardType="decimal-pad"
                value={quantity}
                onFocus={() => onInputFocus?.(fieldOffsets.current.quantity)}
                onBlur={onInputBlur}
                onChangeText={setQuantity}
                placeholder={asset.price > 100 ? "0.01" : "100"}
              /></View>
              <Row style={{ flexWrap: 'wrap', gap: 8 }}>
                <AppButton
                  compact
                  variant="secondary"
                  label="25% funds"
                  onPress={() =>
                    setQuantity(
                      (
                        (wallet.cash * 0.25) /
                        (unitValue * (1 + feeRate))
                      ).toFixed(5),
                    )
                  }
                />
                <AppButton
                  compact
                  variant="secondary"
                  label="50% funds"
                  onPress={() =>
                    setQuantity(
                      (
                        (wallet.cash * 0.5) /
                        (unitValue * (1 + feeRate))
                      ).toFixed(5),
                    )
                  }
                />
              </Row>
              <View onLayout={event => { fieldOffsets.current.sl = event.nativeEvent.layout.y; }}><AppInput
                label="Stop loss (optional)"
                keyboardType="decimal-pad"
                value={sl}
                onFocus={() => onInputFocus?.(fieldOffsets.current.sl)}
                onBlur={onInputBlur}
                onChangeText={setSl}
                placeholder="Price level"
              /></View>
              <View onLayout={event => { fieldOffsets.current.tp = event.nativeEvent.layout.y; }}><AppInput
                label="Take profit (optional)"
                keyboardType="decimal-pad"
                value={tp}
                onFocus={() => onInputFocus?.(fieldOffsets.current.tp)}
                onBlur={onInputBlur}
                onChangeText={setTp}
                placeholder="Price level"
              /></View>
            </>
          )}
          <GlassCard>
            <Row style={{ flexWrap: 'wrap', gap: 8 }}>
              <Label muted>Available virtual funds</Label>
              <Label bold>{money(wallet.cash)}</Label>
            </Row>
            <Row style={{ flexWrap: 'wrap', gap: 8 }}>
              <Label muted>Order collateral · 1:1</Label>
              <Label>{money(Number.isFinite(value) ? value : 0)}</Label>
            </Row>
            <Row style={{ flexWrap: 'wrap', gap: 8 }}>
              <Label muted>Estimated fee · 0.02%</Label>
              <Label>{money(Number.isFinite(fee) ? fee : 0)}</Label>
            </Row>
            {!embedded && <Label muted size={11}>
              Long and short positions both reserve full collateral. Closing
              also incurs a 0.02% fee. No leverage or spread in this model.
            </Label>}
          </GlassCard>
          {!!error && <ErrorState message={error} />}
          <RiskRing risk={estimateOrderRisk(asset, direction ?? 'buy', q, sl.trim() ? Number(sl) : undefined, wallet.cash)} />
          <AppButton
            label={review ? "Confirm virtual order" : "Review order"}
            variant={direction === "sell" ? "danger" : "primary"}
            onPress={submit}
            busy={busy}
            disabled={!ready}
          />
          {review && (
            <AppButton
              label="Edit order"
              variant="secondary"
              onPress={() => setReview(false)}
            />
          )}
        </>
      )}
    </OrderSurface>
  );
}

/** Reuses the same order content inside an already-presented native sheet. */
function OrderSurface({ embedded, visible, title, onClose, children }: {
  embedded: boolean; visible: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  if (embedded) return visible ? <View style={{ gap: 16 }}><Label size={22} bold>{title}</Label>{children}</View> : null;
  return <Sheet visible={visible} title={title} onClose={onClose}>{children}</Sheet>;
}
