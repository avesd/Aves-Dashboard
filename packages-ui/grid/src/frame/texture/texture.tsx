/**
 * @author Avesd
 * @package Grid
 * @namespace Frame_Texture
 * @description Texture
 */

import type { FC } from "react";

export type FrameTextureStyle = "none" | "grid" | "dots" | "lines";

export type FrameTextureProps = {
    readonly texture: FrameTextureStyle;
};

export const FrameTexture: FC<FrameTextureProps> = (props: FrameTextureProps) => {

    const { texture } = props;

    return texture === "none" ? null : (<div
        className="avesd-frame-texture"
        data-texture={texture}
        aria-hidden="true"
        inert
    />);
};
