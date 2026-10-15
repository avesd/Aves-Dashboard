import { cva } from "class-variance-authority";

export const frameSectionStyle = cva("avesd-frame-section", {
    variants: {
        padding: {
            none: "is-padding-none",
            normal: "is-padding-normal",
        },
    },
    defaultVariants: { padding: "normal" },
});

export const gridStyle = cva("avesd-grid", {
    variants: {
        columns: {
            1: "is-columns-one",
            2: "is-columns-two",
        },
    },
    defaultVariants: { columns: 2 },
});
