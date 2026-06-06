import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
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
          fontSize: 26,
          letterSpacing: -1,
          lineHeight: 1,
          paddingTop: 2,
          borderRadius: 6,
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
