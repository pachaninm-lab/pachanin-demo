import type { GektaLocale } from './content';
import { compileSuppliedForm } from './supplied-decimal';

const questions = {
  field_yellowing: [
    'На яровой пшенице @ref после @rain мм дождя пожелтели растения в ложбинах, на повышениях зелёные. Отдели факты от причин. Какие два сравнения сделать между зонами?',
    'Зерновое поле @ref. После @rain мм осадков в двух ложбинах пожелтели листья яровой пшеницы. На гребне растения здоровы. Раздели наблюдения и гипотезы. Какие два парных замера сделать на месте?',
    'In spring wheat @ref, after @rain mm rain plants yellowed in low areas while raised ground is green. Separate facts and hypotheses. Give two paired checks.',
    '@ref春小麦降雨@rain毫米后低洼处发黄，高处仍绿。分清观察与假设，提出两项病区和健区配对检查。',
  ],
  emergence_pattern: [
    'На участке @ref с культурой @crop слабые всходы повторяются через @rows рядов, в местах разворота сбой менее регулярный. Какие данные отличат работу сеялки от качества партии семян или состояния почвы?',
    'In plot @ref (@crop) emergence gaps recur every @rows rows, less regularly on headlands. Which measurements distinguish planter issues from seed-lot or soil variability?',
    '@ref田种@crop，每隔@rows行出苗差，地头的间隔不规则。哪些数据能区分播种机、种子批次和土壤因素？',
  ],
  weed_survey: [
    'Поле @ref, @crop. На @days-й день после обхода заметили новые очаги сорняков только на кромке. Как проверить плотность, состав и распространение и что запросить перед выбором меры?',
    'Field @ref, @crop: @days days after scouting, new weed patches appear at the edge only. How do you quantify density, identity and spread, and what inputs are needed before choosing control?',
    '@ref田种@crop，巡田后第@days天仅田边出现新的杂草斑。如何量化密度、辨认种类和范围？选措施前需什么信息？',
  ],
  leaf_spots: [
    'На @ref у @crop через @days дней после смены погоды пятна на нижних листьях местами совпадают со следами проходов. Фото из одной точки. Как безопасно сузить причины до следующего решения?',
    'In @ref (@crop), lower-leaf spots appeared @days days after a weather change, partly along passes. Only one photo. How would you distinguish plausible causes before deciding what to do?',
    '@ref田的@crop在天气变化后@days天见下部叶斑，部分沿作业带。只有一个地点的照片。决策前如何缩小原因范围？',
  ],
  runoff_observation: [
    'После @rain мм дождя на @ref (@crop) видны промоины, местами уплотнённая корка и следы стока к одному углу. Какие наблюдения собрать для решения о локальном восстановлении?',
    'After @rain mm rain on @ref (@crop), there are rills, crust and runoff towards one corner. What observations support a targeted recovery decision?',
    '@ref田的@crop经历@rain毫米降雨后有冲沟、板结和流向一角的水痕。怎样调查才能决定局部恢复？',
  ],
  combine_inspection: [
    'Комбайн @ref на уборке @crop подаёт сигнал о заторе. Влажность изменилась после @rain мм осадков. В какой последовательности действовать до осмотра? Какие данные смотреть после безопасной остановки?',
    'На зерновой уборке комбайн @ref стал забиваться влажной соломой. Что оператор должен сделать перед осмотром и какие три фактора проверить снаружи после безопасной остановки?',
    'Combine @ref signals a blockage in @crop after @rain mm rain changed conditions. What is the safe sequence before inspection and which observations follow?',
    '@ref收割机在@rain毫米降雨后收获@crop时报警堵塞。检查前安全顺序是什么？安全停机后观察哪些信息？',
  ],
  silo_alarm: [
    'В силосе @ref с @crop один датчик за @days дня поднялся с @initial до @final °C. У соседних датчиков тренда нет. Какие первые проверки сделать снаружи и кому передать сигнал?',
    'In bin @ref with @crop, one sensor rose from @initial to @final °C in @days days; adjacent sensors are flat. What external checks and escalation are appropriate?',
    '@ref仓存@crop，一个测点@days天由@initial℃升至@final℃，邻点平稳。先做哪些外部检查，该向谁报告？',
  ],
  irrigation_diagnosis: [
    'На участке @ref с @crop пожелтение совпало с двумя участками полива. Последний полив @days дней назад. Какие замеры помогут понять, где проблема в подаче, а где в почве?',
    'On @ref (@crop), yellow areas align with two irrigation zones; irrigation was @days days ago. Which measurements separate irrigation delivery problems from soil differences?',
    '@ref田的@crop黄化与两个灌溉小区吻合，上次灌溉在@days天前。如何测量区分供水分布问题与土壤差异？',
  ],
  condensation_check: [
    'При наружном осмотре склада @ref с @crop через @days дня после приёмки есть конденсат в одной зоне. Остальные данные нормальны. Что записать и что проверить, прежде чем объединять эту партию с другой?',
    'During external inspection of store @ref, @crop shows condensation in one area @days days after intake. Other readings are normal. What should be recorded and checked before combining lots?',
    '@ref仓的@crop入仓@days天后外部巡检发现一处冷凝，其他读数正常。合并批次前应记录和检查什么？',
  ],
  milk_yield_observations: [
    'В молочной группе @ref удой снизился на @rate% спустя @days дня после перехода на другую партию сенажа. В соседней группе рацион прежний. Какие журналы и контрольные показатели отделят связь с кормом от других причин?',
    'В молочной группе @ref после замены партии сенажа средний удой снизился. Две другие группы без изменений. Какие наблюдения собрать за двое суток, прежде чем связывать падение с конкретной причиной?',
    'Dairy group @ref fell @rate% in milk yield @days days after a forage batch change. The adjacent group is unchanged. What records and control checks separate feed association from other causes?',
    '@ref奶牛群更换青贮批次后@days天产奶量下降@rate%，相邻群未改变日粮。查询哪些记录和对照指标以区分原因？',
  ],
  rotation_records: [
    'На поле @ref в прошлом сезоне была культура @crop. После уборки прошло @days дней. Данных о влажности, засорённости и истории обработок нет. Какие записи собрать для обоснованного выбора следующей культуры?',
    'Field @ref grew @crop last season, harvested @days days ago. Moisture, weeds and treatment history are unknown. What records support choosing the next crop?',
    '@ref地上季种@crop，收获后@days天。缺乏墒情、草情及管理历史。选择下季作物前收集哪些记录？',
  ],
  root_observation_update: [
    'Дополнение по @ref: после @rain мм дождя вытянули корни из ложбины, они тёмные и пахнут затхло. В соседней высокой зоне корни светлые. Как обновить гипотезы и что проверить первым?',
    'Update for @ref: after @rain mm rain, roots from the low area are dark and musty while roots on higher ground are light. How should hypotheses change and what is the first check?',
    '@ref更新：降雨@rain毫米后低洼区根发暗且有霉味，高处根色较浅。如何调整假设，先核查什么？',
  ],
  unidentified_patch: [
    'Нужно решить, что делать с «пятном @ref». Сорт, культура, размер пятна и стадия неизвестны. Какие минимальные детали запросить и какие наблюдения можно собрать уже сейчас?',
    'The note says only “patch @ref”. Crop, cultivar, area and stage are unknown. What minimal details do you request and what observations can be collected now?',
    '记录仅写“斑块@ref”。作物、品种、面积、生育期未知。最少要问哪些信息？现在可收集哪些观察？',
  ],
  market_average_comparison: [
    'Учебная записка @ref: опубликовано среднее по региону @average ₽/т за месяц @month, а адресная оферта на @mass т товара @crop сегодня — @price ₽/т EXW. Можно ли сказать, что покупатель занижает цену? Дай условия сопоставимости и поясни, как их проверить.',
    'Memo @ref: regional monthly average for month @month is @average RUB/t. Today one buyer offers @price RUB/t EXW for @mass t of @crop. Does this prove underpricing? Describe concrete comparability checks.',
    '练习备忘录@ref：第@month月地区均价@average卢布/吨，买方今日对@mass吨@crop报EXW每吨@price卢布。这个差值能证明报价偏低吗？列出具体可比条件。',
  ],
  unverified_quote: [
    'Журнал закупщика @ref, @crop, @mass т. В скриншоте чата написано «ориентир @price ₽/т», дата, регион и базис не указаны. Покупателя или источник нельзя идентифицировать. Что можно ответить руководителю из этой записи и какие сведения запросить для актуального сравнения?',
    'Buyer log @ref, @mass t of @crop: a screenshot says “indicative @price RUB/t” with no date, region, basis or identifiable source. What can be reported from this evidence and what would verify a valid comparison?',
    '采购日志@ref涉及@mass吨@crop。聊天截图只有“参考每吨@price卢布”，无日期、地区、基准或可辨来源。可向主管确认什么？需补充哪些信息做现价比较？',
  ],
  incomparable_offers: [
    'Задача @ref. За @mass т, @crop, A устно предложил @priceA ₽/т без данных по НДС и месту, B предлагает @priceB ₽/т с НДС CPT, место назначения ещё обсуждается. Список уточнений, чтобы посчитать чистую выручку, и формула для сравнения. Расходы и ставку НДС не выдумывай.',
    'Scenario @ref, @mass t of @crop: A quotes @priceA RUB/t verbally with tax and place unspecified. B quotes @priceB RUB/t including VAT on CPT with destination undecided. What fields and formula are needed for a net-receipts comparison? Do not assume costs or a tax rate.',
    '@ref的@mass吨@crop：买家A口头报@priceA卢布/吨，税费和地点不明；买家B报@priceB卢布/吨含税、CPT，目的地未定。应补齐哪些信息、用什么公式比较净到账？不要假设成本和税率。',
  ],
} as const;

type GuidanceTopic = keyof typeof questions;

const forms = (Object.keys(questions) as GuidanceTopic[]).flatMap(topic =>
  questions[topic].map(question => ({ topic, pattern: compileSuppliedForm(question, { ref: '(?<ref>[\\p{L}\\d][\\p{L}\\d-]{0,40})' }) })),
);

const guidance: Readonly<Record<Exclude<GuidanceTopic, 'unverified_quote'>, Readonly<Record<GektaLocale, string>>>> = {
  field_yellowing: {
    ru: 'Наблюдение — после дождя пожелтели растения в ложбинах, а на повышениях они зелёные. Возможны переувлажнение и нарушение питания через корни. Проверь две пары точек. Сравни влажность и застой воды на одинаковой глубине. Затем сравни состояние корней и нижних листьев у растений одной стадии.',
    en: 'Yellowing after rain was observed in low areas, while plants on raised ground stayed green. Waterlogging and impaired root uptake are hypotheses. In matched sites, compare soil moisture and standing water at the same depth, then compare roots and lower leaves of plants at the same stage.',
    zh: '观察到雨后低洼处黄化，而高处仍绿。积水及根系吸收受阻是待查假设。做两项配对检查：同深度土壤水分和积水情况，以及同生育期植株的根系与下部叶片。',
  },
  emergence_pattern: {
    ru: 'Повторение через одинаковое число рядов — повод проверить сеялку, но по рисунку причина ещё не установлена. Наложи слабые ряды на карту проходов и секций, сверив партии семян. На равных отрезках слабых и нормальных рядов посчитай всходы, сравни глубину заделки, корку и влажность. Отдельно сравни всхожесть сохранённых проб семян.',
    en: 'Map weak rows against planter passes, row units and seed-lot changes. On equal lengths of weak and healthy rows, compare emergence counts, planting depth, soil crust and moisture. Compare retained seed-lot germination separately. Treat periodicity as a lead to investigate.',
    zh: '把弱苗行与播种机行单元、行驶路线和种子批次位置对照。在弱苗行与正常行选相同长度，比较苗数、播深、土壤结皮和水分。单独对照留样的发芽率。周期性只提供排查线索。',
  },
  weed_survey: {
    ru: 'Нанеси очаги на карту и заложи одинаковые учётные рамки по кромке и внутри поля. В каждой посчитай растения на м², запиши виды и стадии сорняков и культуры. Перед выбором меры уточни историю обработок, погоду и близкие чувствительные участки. Фото неизвестных видов доведи до идентификации.',
    en: 'Map the edge patches and sample equal-sized quadrats on the edge and in the field interior. Record plants per square metre, species and growth stages of crop and weeds. Verify treatment records, conditions and nearby sensitive sites before choosing a measure, and identify unknown species first.',
    zh: '绘出田边斑块，在边缘与田内对照点用同样大小的样方记录每平方米株数、杂草种类及杂草和作物生育阶段。确定措施前核对既往处理、天气和邻近敏感区域，先鉴定不明种类。',
  },
  leaf_spots: {
    ru: 'Нанеси пятна на карту и сравни пары похожих растений вдоль прохода и вне него. Зафиксируй стадию, ярус, форму и границы пятен, погоду и даты обработок. Сделай серию фотографий и возьми здоровые и поражённые образцы для агронома или лаборатории. Одного фото для выбора обработки мало.',
    en: 'Map the affected patches and compare matched plants on and off passes. Record crop stage, leaf level, spot shape and edges, weather and treatment history. Take comparable photos and healthy and affected samples for an agronomist or laboratory. Decide after narrowing the cause.',
    zh: '绘制叶斑分布，在作业带内外对照相似植株。记录生育期、受害叶层、斑形和边缘、天气及处理史，补拍对照照片并留健康与受害样本供农艺师或实验室检查。根据核查再决定处理。',
  },
  runoff_observation: {
    ru: 'Отметь направление стока, площадь повреждения и глубину промоин. На пострадавших и соседних нормальных участках сравни густоту, жизнеспособность растений, толщину корки и влажность профиля на одинаковой глубине. Свяжи решение с фазой культуры, фактическим ущербом и проходимостью почвы.',
    en: 'Map runoff direction, affected area and rill depth. Compare stand density, plant viability, crust thickness and soil moisture at matched depths in damaged and unaffected areas. Base recovery on crop stage, measured damage and whether the ground can be worked.',
    zh: '标记水流方向、受损面积及冲沟深度。对照受损区与相邻正常区的苗数、植株存活、结皮厚度和同深度土壤水分。根据生育阶段、实际受损和土壤可通行性决定局部恢复。',
  },
  combine_inspection: {
    ru: 'Прекрати подачу и остановись в безопасном месте. По руководству к комбайну включи стояночный тормоз, отключи приводы, заглуши двигатель, вынь ключ и дождись остановки всех движущихся частей. Для осмотра снаружи проверь три вещи — код сигнала, фактическую подачу и влажность массы, видимые снаружи скопления. Внутренние работы передай допущенному специалисту по процедуре изоляции.',
    en: 'Stop feeding and pull up safely. Follow the combine manual to set the parking brake, disengage drives, stop the engine, remove the key and wait for movement to cease. From outside, check the warning code, feed rate and crop moisture, and any externally visible buildup. Follow the authorised isolation procedure for internal work.',
    zh: '停止喂料并安全停车。按收割机手册拉停车制动、脱开传动、熄火并取下钥匙，等待运动部件完全停止。外部检查报警代码、喂入量与作物湿度，以及外部可见堆积。内部作业由获准人员按隔离流程处理。',
  },
  silo_alarm: {
    ru: 'Передай сигнал ответственному за хранение и оставайся снаружи силоса. Сверь график этого датчика, соседние точки и время замера. Проверь журнал вентиляции и состояние датчика доступным снаружи штатным способом. Один тренд пока показывает отклонение, а причину устанавливает проверка по процедуре объекта.',
    en: 'Escalate to the storage supervisor and stay outside the bin. Compare the sensor’s trend, adjacent readings and timestamps, then check aeration logs and the sensor by the approved external procedure. Treat the trend as an anomaly and follow the site procedure to verify the cause.',
    zh: '立即报告储粮负责人并留在仓外。核对该测点的趋势、邻近测点和时间记录，检查通风日志，并按场站程序从外部核查传感器。先按异常处理，原因仍需查证。',
  },
  irrigation_diagnosis: {
    ru: 'Сопоставь границы пожелтения с зонами и журналом полива. Сравни давление или фактическую подачу воды в больной и здоровой зонах. В парных точках на одинаковой глубине проверь влагу до корней, структуру почвы и состояние корней. Так можно отделить неравномерную подачу воды от различий в её удержании почвой.',
    en: 'Match the yellow areas to irrigation zones and run logs. Compare pressure or actual delivery between affected and healthy areas. At matched soil depths compare moisture down to the roots, soil structure and root condition. This separates delivery from differences in how the soil holds water.',
    zh: '将黄化边界与灌溉分区和运行日志对照。比较受害区与正常区的压力或实际供水量，再配对测同深度的根层水分、土壤结构和根况，以区分供水分布与土壤持水差异。',
  },
  condensation_check: {
    ru: 'Пока держи партию отдельно и сохрани её идентификатор. Запиши место и время появления конденсата, температуру и влажность в этой и соседней зонах в динамике, а также работу вентиляции. Проверь качество партии по представительному отбору проб по процедуре склада. Объединяй после подтверждения качества.',
    en: 'Keep the lot identified and separate. Record where and when condensation appeared, temperature and humidity trends in both affected and comparison areas, and aeration status. Use the facility’s representative sampling procedure and combine lots after quality is confirmed.',
    zh: '保持批次标识，先分开存放。记下冷凝位置和时间、该处与对照区的温湿度走势及通风情况。按仓库程序取代表样确认质量后再合并。',
  },
  milk_yield_observations: {
    ru: 'Сравни записи по удою и состав групп до и после смены партии с группами на прежнем рационе. Проверь фактическую выдачу и остатки корма, влажность сенажа и потребление сухого вещества. Сверь доступность воды, условия в помещении, журнал доения и наблюдения за животными. Совпадение по времени задаёт гипотезу для проверки.',
    en: 'Compare yield records and group composition before and after the forage switch with the unchanged group. Check feed offered and refusals, forage moisture and actual dry-matter intake. Compare water access, barn conditions, milking records and animal observations. The timing gives a hypothesis to investigate.',
    zh: '比较更换前后的产奶记录和群组构成，并用未改日粮的群组对照。检查饲喂量、余料、青贮水分和实际干物质采食量，同时核对饮水、舍内条件、挤奶记录与牛群观察。时间上的联系仍需验证。',
  },
  rotation_records: {
    ru: 'Собери историю культур за несколько сезонов, карты сорняков и болезней, применённые средства защиты и ограничения последействия по их инструкциям. Добавь замеры влаги, дренаж и анализ почвы. Затем сравни несколько вариантов по окну работ, доступной технике и возможностям сбыта.',
    en: 'Gather several seasons of crop records, weed and disease maps, treatment history and label carryover restrictions. Add soil tests, moisture and drainage. Compare feasible crops by work windows, equipment and sales options.',
    zh: '收集多年轮作记录、杂草与病害分布、处理记录及标签上的后茬限制。补齐土壤检测、墒情和排水资料，再比较候选作物的作业窗口、设备和销售条件。',
  },
  root_observation_update: {
    ru: 'Тёмные корни с затхлым запахом в ложбине повышают приоритет переувлажнения и корневого стресса. Сначала сравни в парных точках застой воды, влагу и структуру почвы на одной глубине, состояние и живые ткани корней. Нарушение питания может быть следствием повреждения корней. Причину уточни осмотром или анализом образцов.',
    en: 'Dark, musty roots in the low area make waterlogging and root stress higher-priority hypotheses. First compare standing water, moisture and soil structure at matched depths, and root condition and viability. Nutrient uptake may be affected secondarily. Verify the cause by inspection or sample testing.',
    zh: '低洼区根发暗且有霉味，应先排查积水和根系受损。在配对点比较积水、同深度含水量和结构、根系活性。吸收受阻可能是继发问题，原因需现场检查或样品检测确认。',
  },
  unidentified_patch: {
    ru: 'Уточни культуру, сорт если известен, фазу, поле и регион, когда и где появилось пятно и как оно меняется. Пока сделай фото целого растения, корней, границы пятна и здоровой контрольной зоны. Запиши недавнюю погоду, полив и обработки. Эти сведения нужны до диагноза и выбора меры.',
    en: 'Ask for crop and cultivar if known, growth stage, field and region, onset, location and how the patch is changing. Photograph whole plants, roots, the patch edge and a healthy comparison area. Record recent weather, irrigation and treatments before diagnosing or selecting a measure.',
    zh: '先询问作物、已知品种、生育期、田块和地区、出现时间及斑块变化。可先拍全株、根、斑块边缘和健康区对照，记录近期天气、灌溉和处理，再据此诊断和选措施。',
  },
  market_average_comparison: {
    ru: 'Разница между месячным средним и разовой офертой не доказывает занижение. Сверь дату и место, культуру, класс и качество, объём, базис, НДС, сроки и надёжность оплаты. Возьми независимые датированные оферты на сопоставимую партию и пересчитай их на общие условия. Среднее за месяц пригодится как фон.',
    en: 'The gap between the monthly average and one offer does not establish underpricing. Match date and location, grade and quality, volume, delivery basis, tax and payment terms. Compare independent dated offers for the same kind of lot on a common basis. Use the monthly average as background.',
    zh: '月均价和单笔报价之间的差异不能证明压价。核对日期、地点、作物等级和质量、数量、交付基准、税费和付款条件。找同日独立的可比报价并换算到同一条件，月均价作为背景。',
  },
  incomparable_offers: {
    ru: 'Сравнить чистую выручку можно после уточнений. Для обоих предложений нужны цена и НДС, точное место и базис, расходы продавца на доставку, погрузку и анализ, оплачиваемая масса и допуски качества, срок и надёжность оплаты. Приведи цены к одному налоговому базису. Сумма = сопоставимая цена за тонну × оплачиваемая масса − все расходы продавца. При разной отсрочке приведи суммы к одной дате по согласованной ставке.',
    en: 'Confirm price and tax treatment, named place and basis, seller freight, loading and lab costs, payable mass and quality tolerances, and timing and payment risk for both offers. On one tax basis, net receipts = comparable price per tonne × payable mass minus all seller costs. Bring deferred payments to the same date using an agreed rate before ranking the offers.',
    zh: '先确认双方价格及税费口径、交付基准和具名地点、卖方运费装卸检测成本、计价质量与质量容差、账期和收款风险。按同一税费口径，净到账 = 可比每吨价格 × 计价质量 − 卖方全部成本。账期不同还需用约定费率折到同一天。',
  },
};

function unverifiedQuote(price: string, locale: GektaLocale): string {
  if (locale === 'en') return `The screenshot contains an unverified indication of ${price} RUB/t. It does not establish a current quote. Ask for date and time, location, crop grade and quality, volume, delivery basis, tax and payment terms, and a source you can contact or verify. Compare dated offers on matching terms.`;
  if (locale === 'zh') return `截图只记录未核实的参考价每吨${price}卢布。要核实可比报价，需补齐日期时间、地点、等级质量、吨数、交付基准、税费和付款条件，并向可核实的来源确认。`;
  return `На скриншоте указан неподтверждённый ориентир ${price} ₽/т. Для рыночного сравнения запроси дату и время, регион и точку поставки, класс и качество, объём, базис, НДС и оплату. Затем подтверди условия у идентифицируемого источника или по датированным сопоставимым офертам.`;
}

function fieldCheckTopic(question: string): 'emergence_pattern' | 'irrigation_diagnosis' | null {
  if (!/отлич|различ|отделя|отдели|виноват|проверить|по замер|distinguish|compare|区分/iu.test(question)
    || /дозиров|рецепт|сколько\s+внести|изменить норму|how much to apply|混配|用量/iu.test(question)) return null;
  const soil = /почв|грунт|soil|土壤/iu.test(question);
  if (!soil) return null;
  if (/всход|ряд[^.!?]{0,18}слаб|слаб[^.!?]{0,18}ряд|emergence|出苗|弱苗/iu.test(question)
    && /ряд|\brows?\b|行/iu.test(question) && /сеялк|planter|播种机/iu.test(question)
    && /сем[ея]|seed|种子/iu.test(question)) return 'emergence_pattern';
  if (/желте|пожелт|yellow|黄化/iu.test(question) && /полив|орошен|irrigation|灌溉/iu.test(question)
    && /подач|полив|water delivery|pressure|供水/iu.test(question)) return 'irrigation_diagnosis';
  return null;
}

export function reviewedAgroGuidance(
  question: string,
  history: readonly { role: string; text: string }[],
  locale: GektaLocale,
): { topic: GuidanceTopic; answer: string } | null {
  const normalized = question.trim().replace(/\s+/gu, ' ');
  for (const { topic, pattern } of forms) {
    const match = pattern.exec(normalized)?.groups;
    if (!match) continue;
    if (history.length) {
      if (topic !== 'root_observation_update') return null;
      const latestUser = [...history].reverse().find(turn => turn.role === 'user');
      if (!latestUser || !latestUser.text.includes(match.ref)) return null;
    }
    return { topic, answer: topic === 'unverified_quote' ? unverifiedQuote(match.price, locale) : guidance[topic][locale] };
  }
  const topic = history.length ? null : fieldCheckTopic(normalized);
  return topic ? { topic, answer: guidance[topic][locale] } : null;
}
