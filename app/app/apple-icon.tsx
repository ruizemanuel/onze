import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const bebas = await readFile(
    join(process.cwd(), "assets", "BebasNeue-Regular.ttf"),
  );
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#08070D",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#00DF7C",
          fontFamily: "Bebas Neue",
          fontSize: 150,
          letterSpacing: -6,
          lineHeight: 1,
          paddingTop: 12,
        }}
      >
        11
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Bebas Neue",
          data: bebas,
          style: "normal",
          weight: 400,
        },
      ],
    },
  );
}
