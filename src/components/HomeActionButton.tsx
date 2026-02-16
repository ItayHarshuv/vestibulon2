import { useNavigate } from "react-router-dom";

type HomeActionButtonProps = {
  to: string;
  label: string;
  iconSrc: string;
};

export function HomeActionButton({ to, label, iconSrc }: HomeActionButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="flex items-center justify-between rounded-lg border-2 border-blue-500 px-6 py-5 text-right transition-colors hover:bg-blue-50"
    >
      <span className="text-lg font-semibold text-gray-800">{label}</span>
      <img src={iconSrc} alt="" className="h-12 w-12" aria-hidden="true" />
    </button>
  );
}
