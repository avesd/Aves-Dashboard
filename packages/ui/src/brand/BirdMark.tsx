import type { SVGProps } from "react";

export type BirdMarkDetail = "full" | "regular" | "compact";
export type BirdMarkVariant = "outline" | "solid";

export interface BirdMarkProps extends Omit<SVGProps<SVGSVGElement>, "children" | "viewBox"> {
    readonly detail?: BirdMarkDetail;
    readonly variant?: BirdMarkVariant;
}

const shapes = {
    full: {
        contour: "M27 73C47 51 75 36 105 36C125 36 136 45 137 64C138 83 136 102 146 113C154 123 168 123 184 117C163 136 133 154 104 168C85 177 65 176 51 165C37 153 32 135 35 113C38 91 35 81 27 78L18 78Z",
        eyeCutout: "M52 91A5 6 0 1 0 62 91A5 6 0 1 0 52 91Z",
        strokeWidth: 9,
    },
    regular: {
        contour: "M26 76C47 54 76 42 104 42C124 42 135 52 136 70C137 89 137 104 147 115C155 123 168 122 182 118C162 136 135 153 105 167C86 175 67 173 53 162C40 150 36 133 39 114C42 94 38 82 27 81L18 82Z",
        eyeCutout: "M52 92A7 7 0 1 0 66 92A7 7 0 1 0 52 92Z",
        strokeWidth: 12,
    },
    compact: {
        contour: "M18 89L31 78C54 55 81 47 108 48C127 49 137 59 137 77V100C137 115 149 123 166 122C174 121 179 118 182 115C166 138 140 156 108 170C85 180 62 173 49 157C39 144 38 124 41 105C43 92 38 84 31 84Z",
        eyeCutout: "",
        strokeWidth: 15,
    },
} as const;

export function BirdMark({ detail = "regular", variant = "solid", ...props }: BirdMarkProps) {

    const shape = shapes[detail];
    const named = Boolean(props["aria-label"] || props["aria-labelledby"]);

    return <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 192 192"
        fill="none"
        role={props.role ?? (named ? "img" : undefined)}
        aria-hidden={props["aria-hidden"] ?? !named}
    >
        {variant === "solid" ? <path
            d={shape.contour + shape.eyeCutout}
            fill="currentColor"
            fillRule="evenodd"
        /> : <>
            <path
                d={shape.contour}
                stroke="currentColor"
                strokeWidth={shape.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {detail === "full" && <path
                d="M57 88V94"
                stroke="currentColor"
                strokeWidth="9"
                strokeLinecap="round"
            />}
            {detail === "regular" && <circle
                cx="59"
                cy="92"
                r="6"
                fill="currentColor"
            />}
        </>}
    </svg>;
}
