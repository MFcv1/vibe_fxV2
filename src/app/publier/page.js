import PublierClient from "./PublierClient";

export const metadata = {
  title: "Publier",
  description: "Preparer et publier un visuel Vibe_fx vers le site et les reseaux.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PublierPage() {
  return <PublierClient />;
}
