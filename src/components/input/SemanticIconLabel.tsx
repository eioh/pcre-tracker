import type { Attribute, Role } from "../../domain/types";
import fireIcon from "../../assets/icons/attributes/fire.svg";
import waterIcon from "../../assets/icons/attributes/water.svg";
import windIcon from "../../assets/icons/attributes/wind.svg";
import lightIcon from "../../assets/icons/attributes/light.svg";
import darkIcon from "../../assets/icons/attributes/dark.svg";
import attackerIcon from "../../assets/icons/roles/attacker.svg";
import breakerIcon from "../../assets/icons/roles/breaker.svg";
import bufferIcon from "../../assets/icons/roles/buffer.svg";
import debufferIcon from "../../assets/icons/roles/debuffer.svg";
import boosterIcon from "../../assets/icons/roles/booster.svg";
import healerIcon from "../../assets/icons/roles/healer.svg";
import tankIcon from "../../assets/icons/roles/tank.svg";
import jammerIcon from "../../assets/icons/roles/jammer.svg";

const attributeIconMap: Record<Attribute, string> = {
  火: fireIcon,
  水: waterIcon,
  風: windIcon,
  光: lightIcon,
  闇: darkIcon,
};

const roleIconMap: Record<Role, string> = {
  アタッカー: attackerIcon,
  ブレイカー: breakerIcon,
  バッファー: bufferIcon,
  デバッファー: debufferIcon,
  ブースター: boosterIcon,
  ヒーラー: healerIcon,
  タンク: tankIcon,
  ジャマー: jammerIcon,
};

type SemanticIconLabelProps<T extends string> = {
  value: T;
  iconSrc: string;
};

// 属性・ロールをアイコンだけで表示する。入力は読み上げ名とSVG URL、出力はアクセシブルな画像要素。
function SemanticIconLabel<T extends string>({ value, iconSrc }: SemanticIconLabelProps<T>) {
  return <img alt={value} className="inline-block size-4 shrink-0" src={iconSrc} title={value} />;
}

type AttributeIconLabelProps = {
  attribute: Attribute;
};

// 属性名に対応するSVGを選ぶ。入力は属性、出力は属性名を代替テキストに持つアイコン。
export function AttributeIconLabel({ attribute }: AttributeIconLabelProps) {
  return <SemanticIconLabel iconSrc={attributeIconMap[attribute]} value={attribute} />;
}

type RoleIconLabelProps = {
  role: Role;
};

// ロール名に対応するSVGを選ぶ。入力はロール、出力はロール名を代替テキストに持つアイコン。
export function RoleIconLabel({ role }: RoleIconLabelProps) {
  return <SemanticIconLabel iconSrc={roleIconMap[role]} value={role} />;
}
