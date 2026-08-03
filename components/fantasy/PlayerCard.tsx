import Image from "next/image";
import { Player } from "@/types/player";
import Badge, { BadgeColor } from "@/components/ui/Badge";
import AddPlayerButton from "@/components/fantasy/AddPlayerButton";
import RemovePlayerButton from "@/components/fantasy/RemovePlayerButton";
import CaptainButton from "@/components/fantasy/CaptainButton";
import Card from "@/components/ui/Card";
import { useFantasy } from "@/context/FantasyContext";

type PlayerCardProps = {
  player: Player;
  variant?: "list" | "team";
};

const POSITION_COLORS: Record<Player["position"], BadgeColor> = {
  PG: "blue",
  SG: "green",
  SF: "purple",
  PF: "orange",
  C: "red",
};

function PlayerAvatar({ player }: { player: Player }) {
  const initials =
    player.full_name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  if (player.photo_url) {
    return (
      <Image
        src={player.photo_url}
        alt={player.full_name}
        width={56}
        height={56}
        className="w-14 h-14 rounded-full object-cover border-2 border-gray-100 flex-shrink-0"
      />
    );
  }

  return (
    <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center font-bold text-lg border-2 border-gray-100 flex-shrink-0">
      {initials}
    </div>
  );
}

export default function PlayerCard({
  player,
  variant = "list",
}: PlayerCardProps) {
  const { captainId } = useFantasy();
  const isCaptain = variant === "team" && captainId === player.id;

  return (
    <Card>
      <div className="flex justify-between items-start gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <PlayerAvatar player={player} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold truncate">{player.full_name}</h3>
              {isCaptain && (
                <span className="text-xs font-bold bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full">
                  ×2
                </span>
              )}
            </div>
            {player.teams && (
              <p className="text-sm text-gray-500 truncate">
                {player.teams.name}
              </p>
            )}
          </div>
        </div>
        <Badge text={player.position} color={POSITION_COLORS[player.position]} />
      </div>

      <div className="mt-5 flex items-center justify-between border-t pt-4">
        <span className="text-sm text-gray-500">Стоимость</span>
        <span className="text-lg font-bold text-gray-900">
          💰 {player.price}
        </span>
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
