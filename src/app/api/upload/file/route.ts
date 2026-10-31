import { problem, sellerAccess, sellerRequest } from "../../seller/productUpstream";

export async function POST(req: Request) {
  const access = sellerAccess(req);
  if (access instanceof Response) return access;
  let form: FormData;
  try { form = await req.formData(); } catch { return problem("A file is required."); }
  const file = form.get("file");
  if (!(file instanceof Blob) || !file.size) return problem("Choose a file to upload.");
  if (file.size > 3 * 1024 * 1024) return problem("File size must be at most 3 MB.");
  return sellerRequest(req, "/upload/file", "POST", form);
}
