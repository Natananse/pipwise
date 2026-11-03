import React from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

/** Original code-native illustration for the learning subscription screen. */
export function ProIllustration() {
  return <Svg width="100%" height={220} viewBox="0 0 360 220" accessible={false}>
    <Defs><LinearGradient id="pro-sky" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#DCEBFA" /><Stop offset="1" stopColor="#FFFFFF" /></LinearGradient><LinearGradient id="pro-chart" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#7E77B6" /><Stop offset="1" stopColor="#C1C5DE" /></LinearGradient></Defs>
    <Rect width={360} height={220} fill="url(#pro-sky)" />
    <Circle cx={180} cy={91} r={94} fill="#ECF5FC" />
    <G rotation={-16} origin="36,63"><Rect x={-14} y={12} width={82} height={110} rx={7} fill="#F5D37C" stroke="#6D7892" strokeWidth={2} /><Path d="M0 34H53M0 48H53M0 62H53M0 76H43" stroke="#A58E5B" strokeWidth={2} /><Rect x={0} y={90} width={25} height={11} rx={3} fill="#F08C8D" /></G>
    <G rotation={21} origin="327,105"><Rect x={301} y={56} width={54} height={109} rx={7} fill="#ADAAD2" stroke="#6D7892" strokeWidth={2} /><Rect x={310} y={68} width={36} height={28} rx={3} fill="#D4D8EC" /><Line x1={316} x2={316} y1={90} y2={78} stroke="#71809C" strokeWidth={3} /><Line x1={325} x2={325} y1={90} y2={73} stroke="#71809C" strokeWidth={3} /><Line x1={334} x2={334} y1={90} y2={81} stroke="#71809C" strokeWidth={3} /><Path d="M311 108H345M311 118H345M311 128H339M311 138H341" stroke="#71809C" strokeWidth={2} /></G>
    <Path d="M88 115C76 105 77 87 91 74L111 56L131 76L111 111Z" fill="#F4BE97" stroke="#A18F8B" strokeWidth={1.5} /><Path d="M275 115C288 103 286 88 271 74L249 58L233 77L252 109Z" fill="#F4BE97" stroke="#A18F8B" strokeWidth={1.5} />
    <Rect x={89} y={23} width={184} height={153} rx={18} fill="#C8CCD9" stroke="#6E7891" strokeWidth={3} /><Rect x={100} y={34} width={162} height={129} rx={8} fill="url(#pro-chart)" />
    {[68, 97, 126].map(y => <Line key={y} x1={111} x2={251} y1={y} y2={y} stroke="#C3C3DE" opacity={0.35} />)}
    <Path d="M111 134L124 125L134 144L146 112L159 121L171 77L184 88L199 50L211 80L224 76L238 108L251 95" stroke="#FFFFFF" strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    <Line x1={171} x2={171} y1={77} y2={51} stroke="#ABD87C" strokeWidth={2} /><Circle cx={171} cy={77} r={6} fill="#7E77B6" stroke="#B8E88B" strokeWidth={2} /><Rect x={148} y={36} width={46} height={19} rx={9.5} fill="#A9D47D" /><SvgText x={171} y={49} fill="#FFFFFF" textAnchor="middle" fontSize={10} fontWeight="bold">LEARN</SvgText>
    <Line x1={224} x2={224} y1={76} y2={122} stroke="#F195AA" strokeWidth={2} /><Circle cx={224} cy={76} r={6} fill="#7E77B6" stroke="#F195AA" strokeWidth={2} /><Rect x={201} y={118} width={46} height={19} rx={9.5} fill="#EC91A7" /><SvgText x={224} y={131} fill="#FFFFFF" textAnchor="middle" fontSize={10} fontWeight="bold">GROW</SvgText>
    <G rotation={-23} origin="65,157"><Rect x={58} y={159} width={12} height={52} rx={6} fill="#CDD0E2" stroke="#78859E" strokeWidth={2} /><Circle cx={64} cy={146} r={26} fill="#BAC5DF" stroke="#78859E" strokeWidth={2} /><Circle cx={64} cy={146} r={19} fill="#F9FCFF" /><Path d="M52 151L59 144L66 148L77 135" fill="none" stroke="#8A95BB" strokeWidth={3} strokeLinecap="round" /></G>
    <G><Circle cx={290} cy={169} r={19} fill="#F5D06C" stroke="#61748B" strokeWidth={2.5} /><Circle cx={290} cy={169} r={13} fill="none" stroke="#C5A246" strokeWidth={1.5} /><SvgText x={290} y={175} fill="#50616D" textAnchor="middle" fontSize={18} fontWeight="bold">$</SvgText></G>
    <Path d="M141 194H227" stroke="#E7ECF2" strokeWidth={7} strokeLinecap="round" />
  </Svg>;
}
