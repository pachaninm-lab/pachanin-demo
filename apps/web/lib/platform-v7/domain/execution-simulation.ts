import { selectDealById } from '@/lib/domain/selectors';

export type ExecutionRole = 'operator' | 'seller' | 'buyer' | 'logistics' | 'driver' | 'elevator' | 'lab' | 'bank' | 'surveyor' | 'arbitrator';
export type ExecutionStageKey = 'winner_selected' | 'logistics_request_created' | 'carrier_assigned' | 'driver_assigned' | 'pickup_arrived' | 'loaded' | 'in_transit' | 'elevator_arrived' | 'weighed' | 'lab_passed' | 'documents_signed' | 'money_ready';
export type ExecutionEvidenceStatus = 'ready' | 'pending' | 'blocked';

export interface ExecutionStage {
  key: ExecutionStageKey;
  title: string;
  owner: ExecutionRole;
  description: string;
  requiredForMoney: boolean;
}

export interface ExecutionRoutePoint {
  label: string;
  kind: 'origin' | 'current' | 'destination' | 'checkpoint';
  lat: number;
  lng: number;
  progress: number;
}

export interface ExecutionDocument {
  id: string;
  title: string;
  owner: ExecutionRole;
  status: ExecutionEvidenceStatus;
  moneyImpact: string;
}

export interface ExecutionRoleClosure {
  role: ExecutionRole;
  label: string;
  route: string;
  sees: string;
  action: string;
  next: string;
  closed: boolean;
}

export interface LogisticsRequestSimulation {
  id: string;
  source: 'winning_bid';
  status: 'created' | 'carrier_selected' | 'driver_assigned' | 'trip_active';
  createdFrom: string;
  route: string;
  cargo: string;
  pickupWindow: string;
  deliveryWindow: string;
  requirements: string[];
  visibleForLogistics: string[];
  hiddenForLogistics: string[];
}

export interface ExecutionDriver {
  name: string;
  phoneMasked: string;
  vehicle: string;
  trailer: string;
  seal: string;
  gpsStatus: string;
}

export interface ExecutionSimulation {
  dealId: string;
  lotId: string;
  title: string;
  subtitle: string;
  carrier: string;
  logisticsRequest: LogisticsRequestSimulation;
  driver: ExecutionDriver;
  routeName: string;
  eta: string;
  stages: ExecutionStage[];
  routePoints: ExecutionRoutePoint[];
  documents: ExecutionDocument[];
  roleClosures: ExecutionRoleClosure[];
  releaseBlockers: string[];
  releaseReadyLabel: string;
}

const stages: ExecutionStage[] = [
  { key: 'winner_selected', title: 'Победитель торгов выбран', owner: 'seller', description: 'Продавец принял лучшую ставку. Цена, объём и покупатель зафиксированы.', requiredForMoney: true },
  { key: 'logistics_request_created', title: 'Логистическая заявка создана', owner: 'operator', description: 'Из выигравшей ставки автоматически создана заявка на перевозку без ручного дублирования данных.', requiredForMoney: true },
  { key: 'carrier_assigned', title: 'Перевозчик назначен', owner: 'logistics', description: 'Логистическая роль выбирает перевозчика, машину и окно подачи.', requiredForMoney: true },
  { key: 'driver_assigned', title: 'Водитель назначен', owner: 'logistics', description: 'Рейс передан водителю: маршрут, пломба, машина и контрольные точки доступны в водительском интерфейсе.', requiredForMoney: true },
  { key: 'pickup_arrived', title: 'Подача на погрузку', owner: 'driver', description: 'Водитель прибыл в точку загрузки, время и геометка записаны.', requiredForMoney: true },
  { key: 'loaded', title: 'Погрузка подтверждена', owner: 'surveyor', description: 'Вес при погрузке, фото и пломба добавлены в доказательства.', requiredForMoney: true },
  { key: 'in_transit', title: 'Груз в пути', owner: 'driver', description: 'Маршрут виден по контрольным точкам без раскрытия лишних данных.', requiredForMoney: true },
  { key: 'elevator_arrived', title: 'Прибытие на элеватор', owner: 'elevator', description: 'Элеватор фиксирует заезд, очередь и начало приёмки.', requiredForMoney: true },
  { key: 'weighed', title: 'Вес подтверждён', owner: 'elevator', description: 'Брутто, тара и нетто приняты в контур сделки.', requiredForMoney: true },
  { key: 'lab_passed', title: 'Лаборатория закрыта', owner: 'lab', description: 'Качество подтверждено или отклонение уходит в спор.', requiredForMoney: true },
  { key: 'documents_signed', title: 'Документы подписаны', owner: 'operator', description: 'Транспортный пакет, приёмка, лаборатория и ЭДО собраны.', requiredForMoney: true },
  { key: 'money_ready', title: 'Деньги к проверке', owner: 'bank', description: 'Банк видит полный комплект доказательств для выпуска денег.', requiredForMoney: false },
];

function roleClosures(dealId: string): ExecutionRoleClosure[] {
  return [
    { role: 'seller', label: 'Продавец', route: `/platform-v7/deals/${dealId}/execution`, sees: 'выбранного покупателя, рейс, приёмку, документы и причину задержки денег', action: 'выбирает победителя и контролирует отгрузку', next: `/platform-v7/deals/${dealId}/execution`, closed: true },
    { role: 'buyer', label: 'Покупатель', route: `/platform-v7/deals/${dealId}/execution`, sees: 'свою выигравшую ставку, груз, приёмку, качество и основание выпуска денег', action: 'ждёт исполнения и подтверждает готовность к оплате', next: `/platform-v7/bank/release-safety`, closed: true },
    { role: 'operator', label: 'Оператор', route: '/platform-v7/control-tower', sees: 'весь контур исполнения и блокеры денег', action: 'снимает операционные стопы', next: `/platform-v7/deals/${dealId}/execution`, closed: true },
    { role: 'logistics', label: 'Логистика', route: '/platform-v7/logistics', sees: 'логистическую заявку из выигравшей ставки, перевозчика, водителя, машину, ETA и маршрут', action: 'назначает перевозчика и водителя', next: '/platform-v7/logistics', closed: true },
    { role: 'driver', label: 'Водитель', route: '/platform-v7/driver', sees: 'только назначенный рейс, маршрут и кнопки статуса', action: 'фиксирует прибытие, погрузку, движение и прибытие', next: '/platform-v7/driver', closed: true },
    { role: 'elevator', label: 'Элеватор', route: '/platform-v7/elevator', sees: 'машину, очередь, вес, приёмку и отклонения', action: 'подтверждает вес и факт приёмки', next: '/platform-v7/elevator', closed: true },
    { role: 'lab', label: 'Лаборатория', route: '/platform-v7/lab', sees: 'пробу, показатели качества и протокол', action: 'закрывает качество или открывает отклонение', next: '/platform-v7/lab', closed: true },
    { role: 'bank', label: 'Банк', route: '/platform-v7/bank/release-safety', sees: 'готовность рейса, приёмки, качества и документов', action: 'не выпускает деньги без доказательств', next: `/platform-v7/bank/release-safety`, closed: true },
    { role: 'surveyor', label: 'Сюрвейер', route: '/platform-v7/surveyor', sees: 'фото, пломбу, вес и независимое подтверждение', action: 'закрывает доказательства погрузки', next: `/platform-v7/deals/${dealId}/execution`, closed: true },
    { role: 'arbitrator', label: 'Арбитр', route: '/platform-v7/arbitrator', sees: 'спор, доказательства, документы и деньги под удержанием', action: 'включается только при отклонении', next: '/platform-v7/arbitrator', closed: true },
  ];
}

function documents(): ExecutionDocument[] {
  return [
    { id: 'DOC-LOGREQ', title: 'Логистическая заявка из выигравшей ставки', owner: 'logistics', status: 'ready', moneyImpact: 'Без заявки сделка не переходит в исполнение.' },
    { id: 'DOC-TRIP', title: 'Транспортная заявка и рейс', owner: 'logistics', status: 'ready', moneyImpact: 'Без рейса деньги не переходят к выпуску.' },
    { id: 'DOC-SEAL', title: 'Фото пломбы и погрузки', owner: 'driver', status: 'pending', moneyImpact: 'Без фото и пломбы остаётся риск подмены груза.' },
    { id: 'DOC-WEIGHT', title: 'Весовая квитанция', owner: 'elevator', status: 'pending', moneyImpact: 'Без нетто-веса нельзя подтвердить сумму.' },
    { id: 'DOC-LAB', title: 'Лабораторный протокол', owner: 'lab', status: 'pending', moneyImpact: 'Без качества выпуск денег останавливается.' },
    { id: 'DOC-EDO', title: 'ЭДО-пакет и акт приёмки', owner: 'operator', status: 'pending', moneyImpact: 'Без подписанного пакета банк видит стоп.' },
  ];
}

export function selectExecutionSimulationByDealId(dealId: string): ExecutionSimulation | null {
  const deal = selectDealById(dealId);
  if (!deal) return null;

  const lotId = deal.lotId ?? 'LOT-2403';
  const releaseAmount = deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0);

  return {
    dealId: deal.id,
    lotId,
    title: `${deal.id} · ${deal.grain}`,
    subtitle: `${deal.seller.name} → ${deal.buyer.name} · ${deal.quantity} ${deal.unit} · к проверке денег ${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(releaseAmount)} ₽`,
    carrier: 'СберКорус · Сфера Перевозки · тестовый контур',
    logisticsRequest: {
      id: `LR-${deal.id.replace('DL-', '')}`,
      source: 'winning_bid',
      status: 'created',
      createdFrom: `выигравшая ставка по лоту ${lotId}`,
      route: 'Тамбовская область · хозяйство → элеватор приёмки',
      cargo: `${deal.grain} · ${deal.quantity} ${deal.unit}`,
      pickupWindow: 'сегодня · 14:00–18:00',
      deliveryWindow: 'завтра · 08:00–13:00',
      requirements: ['зерновоз', 'GPS', 'пломба', 'фото погрузки', 'весовой контроль', 'ЭТрН/транспортный пакет'],
      visibleForLogistics: ['культура', 'объём', 'точка погрузки', 'точка выгрузки', 'окна подачи', 'требования к транспорту'],
      hiddenForLogistics: ['цена зерна', 'банковский резерв', 'условия расчётов', 'коммерческие ставки покупателей'],
    },
    driver: {
      name: 'Илья Коротков',
      phoneMasked: '+7 *** ***-42-18',
      vehicle: 'КамАЗ 6520 · А742МР 68',
      trailer: 'зерновоз · прицеп Т918КЕ 68',
      seal: 'Пломба PL-68-2403',
      gpsStatus: 'GPS-сигнал получен · симуляция маршрута',
    },
    routeName: 'Тамбовская область · хозяйство → элеватор приёмки',
    eta: '3 ч 20 мин до элеватора',
    stages,
    routePoints: [
      { label: 'Точка загрузки', kind: 'origin', lat: 52.721, lng: 41.452, progress: 0 },
      { label: 'Контрольная точка 1', kind: 'checkpoint', lat: 52.735, lng: 41.69, progress: 28 },
      { label: 'Текущее положение', kind: 'current', lat: 52.746, lng: 41.925, progress: 58 },
      { label: 'Элеватор', kind: 'destination', lat: 52.763, lng: 42.156, progress: 100 },
    ],
    documents: documents(),
    roleClosures: roleClosures(deal.id),
    releaseBlockers: ['водитель не назначен', 'рейс не завершён', 'приёмка не подтверждена', 'лаборатория не закрыта', 'ЭДО-пакет не подписан'],
    releaseReadyLabel: 'Деньги не выпускаются до закрытия рейса, веса, качества и документов.',
  };
}
