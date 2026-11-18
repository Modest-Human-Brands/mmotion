import type { Component } from 'vue'

import IEar from '~icons/lucide/ear'
import IEye from '~icons/lucide/eye'
import IFlower from '~icons/lucide/flower'
import IHand from '~icons/lucide/hand'
import IUtensils from '~icons/lucide/utensils'
import IBrain from '~icons/lucide/brain'
import IHeart from '~icons/lucide/heart'
import ISmile from '~icons/lucide/smile'
import IFrown from '~icons/lucide/frown'
import IVolume2 from '~icons/lucide/volume-2'
import IVolumeX from '~icons/lucide/volume-x'
import ISun from '~icons/lucide/sun'
import IMoon from '~icons/lucide/moon'
import IHouse from '~icons/lucide/house'
import IUsers from '~icons/lucide/users'
import IUser from '~icons/lucide/user'
import IBaby from '~icons/lucide/baby'
import IMessageCircle from '~icons/lucide/message-circle'
import IClock from '~icons/lucide/clock'
import ICheck from '~icons/lucide/check'
import IStar from '~icons/lucide/star'
import IZap from '~icons/lucide/zap'
import IShield from '~icons/lucide/shield'
import ITarget from '~icons/lucide/target'
import ITrendingUp from '~icons/lucide/trending-up'
import ILightbulb from '~icons/lucide/lightbulb'
import IBookOpen from '~icons/lucide/book-open'
import IMusic from '~icons/lucide/music'
import IGift from '~icons/lucide/gift'
import ICoffee from '~icons/lucide/coffee'
import ILeaf from '~icons/lucide/leaf'
import ISparkles from '~icons/lucide/sparkles'
import IBell from '~icons/lucide/bell'
import ICalendar from '~icons/lucide/calendar'
import IMap from '~icons/lucide/map'
import IRocket from '~icons/lucide/rocket'
import IPuzzle from '~icons/lucide/puzzle'
import IHandHeart from '~icons/lucide/hand-heart'
import IBatteryLow from '~icons/lucide/battery-low'
import IDroplet from '~icons/lucide/droplet'
import IApple from '~icons/lucide/apple'
import ICloud from '~icons/lucide/cloud'
import IThumbsUp from '~icons/lucide/thumbs-up'
import IPhone from '~icons/lucide/phone'
import IMail from '~icons/lucide/mail'
import IGlobe from '~icons/lucide/globe'
import ILock from '~icons/lucide/lock'
import ISettings from '~icons/lucide/settings'
import IChartBar from '~icons/lucide/chart-bar'
import IActivity from '~icons/lucide/activity'
import IFootprints from '~icons/lucide/footprints'
import IArmchair from '~icons/lucide/armchair'
import IBed from '~icons/lucide/bed'
import ISofa from '~icons/lucide/sofa'
import ITreePine from '~icons/lucide/tree-pine'
import IGraduationCap from '~icons/lucide/graduation-cap'
import IBriefcase from '~icons/lucide/briefcase'
import IDollarSign from '~icons/lucide/dollar-sign'
import IPercent from '~icons/lucide/percent'
import ITimer from '~icons/lucide/timer'
import IHourglass from '~icons/lucide/hourglass'
import ISearch from '~icons/lucide/search'
import IListChecks from '~icons/lucide/list-checks'
import IMegaphone from '~icons/lucide/megaphone'
import IHandshake from '~icons/lucide/handshake'
import IHeadphones from '~icons/lucide/headphones'
import IShieldCheck from '~icons/lucide/shield-check'
import IFeather from '~icons/lucide/feather'
import IShoppingBag from '~icons/lucide/shopping-bag'
import ICar from '~icons/lucide/car'
import IBike from '~icons/lucide/bike'
import IPackage from '~icons/lucide/package'
import ICamera from '~icons/lucide/camera'

/** Icons the agents may name in diagrams. Bundled at build time; unknown names render nothing. */
export const ICONS: Record<string, Component> = {
  ear: IEar,
  eye: IEye,
  flower: IFlower,
  hand: IHand,
  utensils: IUtensils,
  brain: IBrain,
  heart: IHeart,
  smile: ISmile,
  frown: IFrown,
  'volume-2': IVolume2,
  'volume-x': IVolumeX,
  sun: ISun,
  moon: IMoon,
  house: IHouse,
  users: IUsers,
  user: IUser,
  baby: IBaby,
  'message-circle': IMessageCircle,
  clock: IClock,
  check: ICheck,
  star: IStar,
  zap: IZap,
  shield: IShield,
  target: ITarget,
  'trending-up': ITrendingUp,
  lightbulb: ILightbulb,
  'book-open': IBookOpen,
  music: IMusic,
  gift: IGift,
  coffee: ICoffee,
  leaf: ILeaf,
  sparkles: ISparkles,
  bell: IBell,
  calendar: ICalendar,
  map: IMap,
  rocket: IRocket,
  puzzle: IPuzzle,
  'hand-heart': IHandHeart,
  'battery-low': IBatteryLow,
  droplet: IDroplet,
  apple: IApple,
  cloud: ICloud,
  'thumbs-up': IThumbsUp,
  phone: IPhone,
  mail: IMail,
  globe: IGlobe,
  lock: ILock,
  settings: ISettings,
  'chart-bar': IChartBar,
  activity: IActivity,
  footprints: IFootprints,
  armchair: IArmchair,
  bed: IBed,
  sofa: ISofa,
  'tree-pine': ITreePine,
  'graduation-cap': IGraduationCap,
  briefcase: IBriefcase,
  'dollar-sign': IDollarSign,
  percent: IPercent,
  timer: ITimer,
  hourglass: IHourglass,
  search: ISearch,
  'list-checks': IListChecks,
  megaphone: IMegaphone,
  handshake: IHandshake,
  headphones: IHeadphones,
  'shield-check': IShieldCheck,
  feather: IFeather,
  'shopping-bag': IShoppingBag,
  car: ICar,
  bike: IBike,
  package: IPackage,
  camera: ICamera,
}

export const ICON_NAMES = Object.keys(ICONS)