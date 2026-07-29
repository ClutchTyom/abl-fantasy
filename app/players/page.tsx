import PlayerCard from "@/components/fantasy/PlayerCard";
import SectionTitle from "@/components/ui/SectionTitle";
import { players } from "@/data/players";

export default function PlayersPage() {
  return (
    <main className="max-w-6xl mx-auto p-8">

      <SectionTitle>
        Игроки ABL
      </SectionTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {players.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
          />
        ))}

      </div>

    </main>
  );
}