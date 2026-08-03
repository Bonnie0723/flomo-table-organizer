const isPages = process.env.GITHUB_ACTIONS === "true";
const repo = process.env.GITHUB_REPOSITORY?.split("/")[1] || "";

/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  images: { unoptimized: true },
  basePath: isPages && repo ? `/${repo}` : "",
  assetPrefix: isPages && repo ? `/${repo}/` : "",
  trailingSlash: true,
};

export default config;
