import { Player } from "@/types/player";
import Badge from "@/components/ui/Badge";
import AddPlayerButton from "@/components/fantasy/AddPlayerButton";
import RemovePlayerButton from "@/components/fantasy/RemovePlayerButton";
import CaptainButton from "@/components/fantasy/CaptainButton";
import Card from "@/components/ui/Card";
import { useFantasy } from "@/context/FantasyContext";

type PlayerCardProps = {
  player: Player;
  variant?: "list" | "team";
};

export default function PlayerCard({
  player,
  variant = "list",
}: PlayerCardProps) {
  const { captainId } = useFantasy();
  const isCaptain = variant === "team" && captainId === player.id;

  return (
    <Card>
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold">{player.full_name}</h3>
            {isCaptain && (
              <span className="text-xs font-bold bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full">
                ×2
              </span>
            )}
          </div>
          {player.teams && (
            <p className="text-sm text-gray-500">{player.teams.name}</p>
          )}
        </div>
        <Badge text={player.position} />
      </div>

      <div className="mt-5 space-y-2">
        <p>
          💰 Стоимость: <b>{player.price}</b>
        </p>
      </div>

      <div className="mt-6 flex gap-3 flex-wrap">
        {variant === "team" ? (
          <>
            <CaptainButton player={player} />
            <RemovePlayerButton player={player} />
          </>
        ) : (
          <AddPlayerButton player={player} />
        )}
      </div>
    </Card>
  );
}