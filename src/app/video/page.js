import HomeScreen from "@/features/vibecut/home/HomeScreen";

export const metadata = {
  title: "VibeCut",
  robots: {
    index: false,
    follow: false,
  },
};

export default function VibeCutHomePage() {
  return <HomeScreen />;
}
