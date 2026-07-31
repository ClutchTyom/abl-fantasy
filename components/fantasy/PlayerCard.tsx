import { Player } from "@/types/player";
import Badge from "@/components/ui/Badge";
import AddPlayerButton from "@/components/fantasy/AddPlayerButton";
import RemovePlayerButton from "@/components/fantasy/RemovePlayerButton";
import Card from "@/components/ui/Card";

type PlayerCardProps = {
  player: Player;
  variant?: "list" | "team";
};

export default function PlayerCard({
  player,
  variant = "list",
}: PlayerCardProps) {
  return (
    <Card>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-bold">{player.full_name}</h3>
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

<div className="mt-6">
        {variant === "team" ? (
          <RemovePlayerButton player={player} />
        ) : (
          <AddPlayerButton player={player} />
        )}
      </div>
    </Card>
  );
}