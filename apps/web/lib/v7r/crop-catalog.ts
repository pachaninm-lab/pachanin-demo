export interface CropCatalogItem {
  id: string;
  group: 'Зерновые' | 'Зернобобовые' | 'Масличные' | 'Технические' | 'Кормовые' | 'Овощи' | 'Сад и ягоды';
  name: string;
  qualityKeys: string[];
  docKeys: string[];
  logisticsNotes: string[];
}

export const RF_CROP_CATALOG: CropCatalogItem[] = [
  { id: 'wheat-soft', group: 'Зерновые', name: 'Пшеница мягкая', qualityKeys: ['Белок', 'Клейковина', 'Влажность', 'Натура'], docKeys: ['СДИЗ', 'Протокол качества', 'ТТН/ЭПД'], logisticsNotes: ['Авто и ж/д', 'Часто требуется лаборатория на приёмке'] },
  { id: 'wheat-hard', group: 'Зерновые', name: 'Пшеница твёрдая', qualityKeys: ['Белок', 'Стекловидность', 'Влажность'], docKeys: ['СДИЗ', 'Протокол качества'], logisticsNotes: ['Требовательна к качественному паспорту'] },
  { id: 'barley', group: 'Зерновые', name: 'Ячмень', qualityKeys: ['Натура', 'Влажность', 'Сорная примесь'], docKeys: ['СДИЗ', 'Протокол качества'], logisticsNotes: ['Авто и ж/д', 'Кормовой и пивоваренный сценарии различаются'] },
  { id: 'corn', group: 'Зерновые', name: 'Кукуруза', qualityKeys: ['Влажность', 'Сорная примесь', 'Зерновая примесь'], docKeys: ['СДИЗ', 'Протокол качества'], logisticsNotes: ['Высокая чувствительность к влажности'] },
  { id: 'rye', group: 'Зерновые', name: 'Рожь', qualityKeys: ['Натура', 'Влажность'], docKeys: ['СДИЗ', 'Протокол качества'], logisticsNotes: ['Часто региональные маршруты'] },
  { id: 'oats', group: 'Зерновые', name: 'Овёс', qualityKeys: ['Натура', 'Плёнчатость', 'Влажность'], docKeys: ['СДИЗ', 'Протокол качества'], logisticsNotes: ['Часто кормовой контур'] },
  { id: 'triticale', group: 'Зерновые', name: 'Тритикале', qualityKeys: ['Натура', 'Влажность'], docKeys: ['СДИЗ'], logisticsNotes: ['Часто региональные поставки'] },
  { id: 'millet', group: 'Зерновые', name: 'Просо', qualityKeys: ['Влажность', 'Примесь'], docKeys: ['СДИЗ'], logisticsNotes: ['Чувствительно к очистке партии'] },
  { id: 'sorghum', group: 'Зерновые', name: 'Сорго', qualityKeys: ['Влажность', 'Примесь'], docKeys: ['СДИЗ'], logisticsNotes: ['Нишевый рынок'] },
  { id: 'rice', group: 'Зерновые', name: 'Рис', qualityKeys: ['Влажность', 'Треснувшие зерна'], docKeys: ['СДИЗ', 'Протокол качества'], logisticsNotes: ['Особые требования хранения'] },
  { id: 'buckwheat', group: 'Зерновые', name: 'Гречиха', qualityKeys: ['Влажность', 'Примесь'], docKeys: ['СДИЗ'], logisticsNotes: ['Часто короткая логистика'] },
  { id: 'pea', group: 'Зернобобовые', name: 'Горох', qualityKeys: ['Влажность', 'Битые зерна'], docKeys: ['СДИЗ'], logisticsNotes: ['Чувствителен к повреждению'] },
  { id: 'chickpea', group: 'Зернобобовые', name: 'Нут', qualityKeys: ['Калибр', 'Влажность'], docKeys: ['СДИЗ'], logisticsNotes: ['Экспортный сценарий'] },
  { id: 'lentil', group: 'Зернобобовые', name: 'Чечевица', qualityKeys: ['Калибр', 'Влажность'], docKeys: ['СДИЗ'], logisticsNotes: ['Экспортный сценарий'] },
  { id: 'soy', group: 'Масличные', name: 'Соя', qualityKeys: ['Протеин', 'Влажность', 'Масличность'], docKeys: ['СДИЗ', 'Протокол качества'], logisticsNotes: ['Часто переработка и экспорт'] },
  { id: 'sunflower', group: 'Масличные', name: 'Подсолнечник', qualityKeys: ['Масличность', 'Влажность', 'Сорная примесь'], docKeys: ['СДИЗ', 'Протокол качества'], logisticsNotes: ['Критична масличность'] },
  { id: 'rapeseed', group: 'Масличные', name: 'Рапс', qualityKeys: ['Масличность', 'Влажность'], docKeys: ['СДИЗ'], logisticsNotes: ['Экспортные и перерабатывающие маршруты'] },
  { id: 'oil-flax', group: 'Масличные', name: 'Лен масличный', qualityKeys: ['Масличность', 'Влажность'], docKeys: ['СДИЗ'], logisticsNotes: ['Нишевый экспорт'] },
  { id: 'mustard', group: 'Масличные', name: 'Горчица', qualityKeys: ['Влажность', 'Примесь'], docKeys: ['СДИЗ'], logisticsNotes: ['Нишевый рынок'] },
  { id: 'safflower', group: 'Масличные', name: 'Сафлор', qualityKeys: ['Масличность', 'Влажность'], docKeys: ['СДИЗ'], logisticsNotes: ['Нишевый рынок'] },
  { id: 'sugar-beet', group: 'Технические', name: 'Сахарная свёкла', qualityKeys: ['Сахаристость', 'Загрязнённость'], docKeys: ['ТТН/ЭПД'], logisticsNotes: ['Очень чувствительна к окнам поставки'] },
  { id: 'potato', group: 'Технические', name: 'Картофель', qualityKeys: ['Калибр', 'Повреждения'], docKeys: ['ТТН/ЭПД'], logisticsNotes: ['Нужен температурный контроль'] },
  { id: 'hemp', group: 'Технические', name: 'Конопля техническая', qualityKeys: ['Влажность'], docKeys: ['ТТН/ЭПД'], logisticsNotes: ['Спецконтур'] },
  { id: 'alfalfa', group: 'Кормовые', name: 'Люцерна', qualityKeys: ['Влажность', 'Протеин'], docKeys: ['ТТН/ЭПД'], logisticsNotes: ['Кормовой контур'] },
  { id: 'clover', group: 'Кормовые', name: 'Клевер', qualityKeys: ['Влажность'], docKeys: ['ТТН/ЭПД'], logisticsNotes: ['Кормовой контур'] },
  { id: 'cabbage', group: 'Овощи', name: 'Капуста', qualityKeys: ['Калибр', 'Сохранность'], docKeys: ['ТТН/ЭПД'], logisticsNotes: ['Скоропортящийся контур'] },
  { id: 'carrot', group: 'Овощи', name: 'Морковь', qualityKeys: ['Калибр', 'Сохранность'], docKeys: ['ТТН/ЭПД'], logisticsNotes: ['Скоропортящийся контур'] },
  { id: 'onion', group: 'Овощи', name: 'Лук', qualityKeys: ['Калибр', 'Сухое вещество'], docKeys: ['ТТН/ЭПД'], logisticsNotes: ['Складской и скоропортящийся контур'] },
  { id: 'apple', group: 'Сад и ягоды', name: 'Яблоко', qualityKeys: ['Калибр', 'Сохранность'], docKeys: ['ТТН/ЭПД'], logisticsNotes: ['Нужен холодный контур'] },
  { id: 'pear', group: 'Сад и ягоды', name: 'Груша', qualityKeys: ['Калибр', 'Сохранность'], docKeys: ['ТТН/ЭПД'], logisticsNotes: ['Нужен холодный контур'] },
  { id: 'grapes', group: 'Сад и ягоды', name: 'Виноград', qualityKeys: ['Сахаристость', 'Сохранность'], docKeys: ['ТТН/ЭПД'], logisticsNotes: ['Очень чувствителен к логистике'] }
];

export interface LotMeta {
  region: string;
  district: string;
  basis: string;
  cropGroup: string;
  quality: Record<string, string>;
  documents: string[];
  logistics: string[];
  harvestYear: string;
  deliveryWindow: string;
  warehouse: string;
  sellerName: string;
  buyerTypeHint: string;
  fgisStatus: string;
  sdizStatus: string;
}

export const LOT_META: Record<string, LotMeta> = {
  'LOT-2401': {
    region: 'Тамбовская область', district: 'Тамбовский район', basis: 'CPT элеватор', cropGroup: 'Зерновые',
    quality: { 'Белок': '12.4%', 'Клейковина': '24%', 'Влажность': '13.2%', 'Натура': '765 г/л' },
    documents: ['СДИЗ', 'Протокол качества', 'ТТН/ЭПД'], logistics: ['Авто', 'Ж/д после консолидации'], harvestYear: '2025', deliveryWindow: '20–30 апреля 2026', warehouse: 'Элеватор Тамбов-Агро', sellerName: 'ООО «Колос»', buyerTypeHint: 'Мельница / трейдер', fgisStatus: 'Требует ручной перепроверки', sdizStatus: 'Черновик',
  },
  'LOT-2402': {
    region: 'Тамбовская область', district: 'Моршанский район', basis: 'EXW склад продавца', cropGroup: 'Зерновые',
    quality: { 'Влажность': '14.8%', 'Сорная примесь': '1.2%', 'Зерновая примесь': '2.1%' },
    documents: ['Акт загрузки', 'Протокол качества'], logistics: ['Авто'], harvestYear: '2025', deliveryWindow: '18–28 апреля 2026', warehouse: 'Склад Моршанск-Юг', sellerName: 'КФХ «Моршанское»', buyerTypeHint: 'Комбикорм / переработчик', fgisStatus: 'Manual контур', sdizStatus: 'Не сформирован',
  },
  'LOT-2403': {
    region: 'Тамбовская область', district: 'Рассказовский район', basis: 'CPT элеватор покупателя', cropGroup: 'Зерновые',
    quality: { 'Натура': '645 г/л', 'Влажность': '12.7%', 'Сорная примесь': '0.8%' },
    documents: ['СДИЗ', 'Протокол качества', 'ТТН/ЭПД'], logistics: ['Авто', 'Сменные окна приёмки'], harvestYear: '2025', deliveryWindow: '22 апреля – 05 мая 2026', warehouse: 'Рассказово-Зерно', sellerName: 'АО «Рассказовский агроцентр»', buyerTypeHint: 'Пивоваренный / кормовой контур', fgisStatus: 'Подтверждено', sdizStatus: 'Подтвержден',
  }
};
