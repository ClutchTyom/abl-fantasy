import Header from "../components/layout/Header";

export default function Home() {
  return (
    <>
      <Header />

      <main className="bg-gray-50 min-h-screen">
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h2 className="text-5xl font-bold text-gray-900 leading-tight">
            Собери команду.
            <br />
            Обыграй друзей.
          </h2>

          <p className="mt-6 text-xl text-gray-600">
            Стань лучшим Fantasy-менеджером Amateur Basketball League.
          </p>

          <button className="mt-10 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl text-lg font-semibold transition">
            Начать играть
          </button>
        </section>

        {/* Почему играют */}
        <section className="max-w-6xl mx-auto px-6 pb-20">
          <h3 className="text-3xl font-bold mb-10 text-center">
            Почему играют в ABL Fantasy?
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow p-6">
              <h4 className="text-xl font-bold">⚔️ Азарт</h4>
              <p className="mt-2 text-gray-600">
                Собирай лучший состав перед каждым туром и соревнуйся с друзьями.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <h4 className="text-xl font-bold">🧠 Докажи экспертность</h4>
              <p className="mt-2 text-gray-600">
                Покажи, что именно ты лучше всех разбираешься в игроках ABL.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <h4 className="text-xl font-bold">🏀 Следи за всей лигой</h4>
              <p className="mt-2 text-gray-600">
                Открывай для себя игроков из других команд и следи за их статистикой.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <h4 className="text-xl font-bold">🏆 Попади в рейтинг</h4>
              <p className="mt-2 text-gray-600">
                Поднимайся в общем зачете и стань лучшим Fantasy-менеджером сезона.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}