// Photographs are supplied by the user. Order is curated and never random.
export const foodChapters = [
  {
    id: 'porridge', title: 'Каши',
    description: 'Ягоды и банан. Бри и мак.\nШоколад и орехи. Или просто классика.',
    layout: 'porridge',
    entries: [
      { id: 'rice-berry-banana', label: 'С ягодами и бананом', image: 'rice-berry.png', alt: 'Рисовая ягодная каша с бананом', width: 1402, height: 1122 },
      { id: 'rice-porridge', label: 'Рисовая', image: 'rice-porridge.png', alt: 'Рисовая каша со сливочным маслом', width: 1402, height: 1122 },
      { id: 'oatmeal', label: 'Овсяная', image: 'oatmeal.png', alt: 'Овсяная каша со сливочным маслом', width: 1402, height: 1122 },
      { id: 'oatmeal-cheese-poppy', label: 'С бри и маком', image: 'oatmeal-cheese.png', alt: 'Овсяная каша с сыром бри и маком', width: 1402, height: 1122 },
      { id: 'oatmeal-chocolate-nuts', label: 'С шоколадом и орехами', image: 'oatmeal-chocolate.png', alt: 'Овсяная каша с шоколадом и орехами', width: 1402, height: 1122 }
    ]
  },
  {
    id: 'syrniki', title: 'Сырники',
    description: 'Золотистая корочка.\nСгущёнка, лесные ягоды или голубика.',
    layout: 'syrniki',
    entries: [
      { id: 'syrniki-condensed', label: 'Со сгущёнкой', image: 'syrniki-condensed.png', alt: 'Сырники со сгущёнкой', width: 4096, height: 4096 },
      { id: 'syrniki-caramel', label: 'С карамельным кремом и ягодами', image: 'syrniki-forest-berries.png', alt: 'Сырники с карамельным кремом и соусом из лесных ягод', width: 4096, height: 4096 },
      { id: 'syrniki-blueberry-cream-cheese', label: 'С голубикой и крем-чизом', image: 'syrniki-blueberry.png', alt: 'Сырники со свежей голубикой и крем-чизом', width: 4096, height: 4096 }
    ]
  },
  {
    id: 'pasta', title: 'Паста',
    description: 'Когда хочется остаться\nи пообедать без спешки.',
    layout: 'pasta',
    entries: [
      { id: 'main-2', label: 'С курицей и трюфелем', image: 'pasta-chicken.png', alt: 'Паста в сливочно-трюфельном соусе с куриным филе', width: 1402, height: 1122 },
      { id: 'main-5', label: 'Карбонара', image: 'carbonara.png', alt: 'Паста карбонара', width: 1402, height: 1122 }
    ]
  }
];

export const locations = [
  { id: 'kompros', address: 'Комсомольский проспект, 53а', route: 'https://2gis.ru/perm/firm/70000001051340508', description: 'Маршрут и актуальное расписание — в карточке пекарни.' },
  { id: 'revolution', address: 'Улица Революции, 24', route: 'https://2gis.ru/perm/firm/70000001095183975', description: 'Маршрут и актуальное расписание — в карточке пекарни.' },
  { id: 'lunacharsky', address: 'Улица Луначарского, 99', route: 'https://2gis.ru/perm/firm/70000001066083955', description: 'Маршрут и актуальное расписание — в карточке пекарни.' },
  { id: 'petropavlovskaya', address: 'Петропавловская улица, 52', route: 'https://2gis.ru/perm/firm/70000001109841158', description: 'В 2ГИС была отметка о временном закрытии. Уточните статус перед визитом.' }
];
