import SectionTitle from "@/components/ui/SectionTitle";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="border rounded-xl p-5 bg-white shadow-sm mb-6">
      {children}
    </div>
  );
}

export default function RulesPage() {
  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-8">
      <SectionTitle>Правила игры</SectionTitle>

      <Card>
        <h2 className="text-xl font-bold mb-2">Что это такое</h2>
        <p className="text-gray-700">
          ABL Fantasy — фэнтези-лига по мотивам реальных дивизионов
          Amateur Basketball League. Вы собираете команду из настоящих
          игроков ABL, а очки начисляются по их реальной статистике в
          сыгранных матчах.
        </p>
      </Card>

      <Card>
        <h2 className="text-xl font-bold mb-2">Сборка состава</h2>
        <ul className="list-disc pl-5 space-y-1 text-gray-700">
          <li>10 слотов: 5 стартовых (по одному на позицию PG/SG/SF/PF/C) и 5 запасных.</li>
          <li>Бюджет — 100 на весь состав, у каждого игрока своя цена.</li>
          <li>Не больше 2 игроков из одной реальной команды ABL.</li>
          <li>Сохранить можно только полностью заполненный состав в рамках бюджета.</li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-xl font-bold mb-2">Цены игроков</h2>
        <p className="text-gray-700">
          Цена — от 8 до 17. Чем выше средние фэнтези-очки игрока за игру,
          тем выше цена: максимальная цена — только у горстки сильнейших
          игроков лиги. Цены периодически пересчитываются по свежей
          статистике, так что стоимость игрока может со временем
          меняться.
        </p>
      </Card>

      <Card>
        <h2 className="text-xl font-bold mb-2">Капитан</h2>
        <p className="text-gray-700">
          Один игрок в составе назначается капитаном — все его очки за
          тур удваиваются. Капитана можно менять в любой момент, пока
          состав не заблокирован.
        </p>
      </Card>

      <Card>
        <h2 className="text-xl font-bold mb-2">Тур и блокировка</h2>
        <p className="text-gray-700 mb-2">
          Тур — календарная неделя. Состав блокируется каждую субботу в
          09:00 по Москве — с этого момента и до конца недели менять его
          нельзя. В очки тура засчитывается статистика по всем матчам
          всех дивизионов ABL, сыгранным в эти выходные.
        </p>
        <p className="text-gray-700">
          Когда открывается новый тур, туда автоматически подставляется
          состав из прошлого тура — можно просто сделать трансферы
          (заменить пары игроков) и сохранить, не пересобирая всё с нуля.
        </p>
      </Card>

      <Card>
        <h2 className="text-xl font-bold mb-2">Как считаются очки</h2>
        <p className="text-gray-700 mb-3">
          Фэнтези-очки игрока за матч считаются по формуле:
        </p>
        <p className="font-mono text-sm bg-gray-50 border rounded-lg p-3 mb-3">
          ОЧКИ + Подборы×1.2 + Передачи×1.5 + Перехваты×2 + Блоки×2.5 +
          Трёхочковые×0.5 − Потери − Промахи 2-очковые×0.5 − Промахи
          3-очковые×0.5 − Промахи штрафных×0.5
        </p>
        <p className="text-gray-700">
          Очки состава за тур = сумма очков всех 10 игроков (очки
          капитана считаются дважды).
        </p>
      </Card>

      <Card>
        <h2 className="text-xl font-bold mb-2">Рейтинг</h2>
        <p className="text-gray-700">
          Общий рейтинг — это сумма очков состава по всем турам с начала
          сезона. Актуальную таблицу смотрите на странице «Рейтинг».
        </p>
      </Card>
    </main>
  );
}
