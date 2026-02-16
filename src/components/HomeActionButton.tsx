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
      className="group relative flex items-center justify-center rounded-lg border-2 border-blue-500 px-6 py-5 text-center transition-colors hover:bg-blue-50 active:bg-blue-500"
    >
      <span className="text-lg font-semibold text-gray-800 transition-colors group-active:text-white">
        {label}
      </span>
      <span
        aria-hidden="true"
        className="absolute right-6 h-12 w-12 shrink-0 bg-gray-700 transition-colors group-active:bg-white"
        style={{
          WebkitMaskImage: `url(${iconSrc})`,
          maskImage: `url(${iconSrc})`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
    </button>
  );
}
