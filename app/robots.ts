import { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://ellyn.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/auth/signup", "/auth/login", "/privacy", "/terms"],
        disallow: [
          "/dashboard/",
          "/admin/",
          "/api/",
          "/extension-auth/",
          "/setup-required/",
          "/compose/",
          "/tracker/",
          "/contacts/",
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
