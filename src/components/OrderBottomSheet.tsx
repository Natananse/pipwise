import React, { useState } from "react";
import { View } from "react-native";
import { Asset, money, price } from "../lib/market";
import { Direction, feeRate } from "../lib/simulator";
import { useWorkspace } from "../lib/workspace";
import { useTheme } from "../lib/theme";
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
}: {
  asset: Asset;
  direction: Direction | null;
  onClose: () => void;
  embedded?: boolean;
}) {
  const { wallet, trade } = useWorkspace();
  const { colors } = useTheme();
  const [quantity, setQuantity] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const q = Number(quantity);
  const value = q * asset.price;
  const fee = value * feeRate;
  const close = () => {
    setSuccess(false);
    setReview(false);
    setError("");
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
      trade(
        asset,
        direction!,
        q,
        sl ? Number(sl) : undefined,
        tp ? Number(tp) : undefined,
      );
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
          <AppButton label="Back to workspace" onPress={close} />
        </>
      ) : (
        <>
          <Badge>VIRTUAL ORDER · NO REAL MONEY</Badge>
          <Row>
            <Label muted>Simulated entry price</Label>
            <Label size={24} bold>
              {price(asset)}
            </Label>
          </Row>
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
                Prices are fixed demo quotes. Protective levels are saved as
                practice targets; automated execution is not connected.
              </Label>
            </GlassCard>
          ) : (
            <>
              <AppInput
                label="Quantity (units)"
                keyboardType="decimal-pad"
                value={quantity}
                onChangeText={setQuantity}
                placeholder={asset.price > 100 ? "0.01" : "100"}
              />
              <Row>
                <AppButton
                  compact
                  variant="secondary"
                  label="25% funds"
                  onPress={() =>
                    setQuantity(
                      (
                        (wallet.cash * 0.25) /
                        (asset.price * (1 + feeRate))
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
                        (asset.price * (1 + feeRate))
                      ).toFixed(5),
                    )
                  }
                />
              </Row>
              <AppInput
                label="Stop loss (optional)"
                keyboardType="decimal-pad"
                value={sl}
                onChangeText={setSl}
                placeholder="Price level"
              />
              <AppInput
                label="Take profit (optional)"
                keyboardType="decimal-pad"
                value={tp}
                onChangeText={setTp}
                placeholder="Price level"
              />
            </>
          )}
          <GlassCard>
            <Row>
              <Label muted>Available virtual funds</Label>
              <Label bold>{money(wallet.cash)}</Label>
            </Row>
            <Row>
              <Label muted>Order collateral · 1:1</Label>
              <Label>{money(Number.isFinite(value) ? value : 0)}</Label>
            </Row>
            <Row>
              <Label muted>Estimated fee · 0.02%</Label>
              <Label>{money(Number.isFinite(fee) ? fee : 0)}</Label>
            </Row>
            <Label muted size={11}>
              Long and short positions both reserve full collateral. Closing
              also incurs a 0.02% fee. No leverage or spread in this model.
            </Label>
          </GlassCard>
          {!!error && <ErrorState message={error} />}
          <AppButton
            label={review ? "Confirm virtual order" : "Review order"}
            variant={direction === "sell" ? "danger" : "primary"}
            onPress={submit}
            busy={busy}
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
