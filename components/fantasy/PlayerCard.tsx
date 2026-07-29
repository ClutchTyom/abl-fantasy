import { Player } from "@/types/player";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

type PlayerCardProps = {
  player: Player;
};

export default function PlayerCard({ player }: PlayerCardProps) {
  return (
    <Card>
      <div className="flex justify-between items-start">

        <div>
          <h3 className="text-xl font-bold">
            {player.firstName} {player.lastName}
          </h3>

          <p className="text-gray-500">
            № {player.number}
          </p>
        </div>

        <Badge text={player.position} />

      </div>

      <div className="mt-5 space-y-2">

        <p>💰 Стоимость: <b>{player.price}</b></p>

        <p>⭐ Fantasy: <b>{player.fantasyPoints}</b></p>

      </div>

      <div className="mt-6">
        <Button>
          Добавить
        </Button>
      </div>

    </Card>
  );
}