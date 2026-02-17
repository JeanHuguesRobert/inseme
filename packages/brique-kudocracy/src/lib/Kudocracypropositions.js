import { getSupabase } from "@inseme/cop-host";
import { appendOrMergeLastModifiedBy } from "../../../cop-host/src/lib/socialMetadata.js";
import { validatePetitionUrl } from "./petitions";

export async function createPropositionWithTags({
  userId,
  userDisplayName = null,
  title,
  description,
  status = "active",
  selectedTags = [],
  petitionUrl = null,
}) {
  if (!userId) throw new Error("userId is required");
  if (!title?.trim() || !description?.trim()) throw new Error("title and description are required");

  // Validate petition URL if provided
  if (petitionUrl) {
    const validation = validatePetitionUrl(petitionUrl);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
  }

  // Build metadata object with lastModifiedBy
  let metadata = {
    schemaVersion: 1,
  };

  // Add petition_url to metadata if provided
  if (petitionUrl && petitionUrl.trim()) {
    metadata.petition_url = petitionUrl.trim();
  }

  // Stamp lastModifiedBy for audit trail
  metadata = appendOrMergeLastModifiedBy(metadata, {
    id: userId,
    displayName: userDisplayName,
  });

  const { data: proposition, error: propError } = await getSupabase()
    .from("propositions")
    .insert({
      title: title.trim(),
      description: description.trim(),
      author_id: userId,
      status,
      metadata,
    })
    .select()
    .single();

  if (propError) throw propError;

  const existingTagIds = selectedTags
    .map((t) => (typeof t === "number" ? t : t?.id))
    .filter((id) => id && !String(id).startsWith("new-"));

  const tagsToCreate = selectedTags
    .filter((t) => typeof t !== "number" && (!t?.id || String(t.id).startsWith("new-")))
    .map((t) => ({ name: (t?.name || "").trim(), description: "" }))
    .filter((tag) => tag.name.length > 0);

  let createdTagIds = [];
  if (tagsToCreate.length > 0) {
    const { data: insertedTags, error: tagsInsertError } = await getSupabase()
      .from("tags")
      .insert(tagsToCreate)
      .select();

    if (tagsInsertError) throw tagsInsertError;
    createdTagIds = insertedTags.map((tag) => tag.id);
  }

  const tagIdsToLink = [...existingTagIds, ...createdTagIds];

  if (tagIdsToLink.length > 0) {
    const linkPayload = tagIdsToLink.map((tagId) => ({
      proposition_id: proposition.id,
      tag_id: tagId,
    }));

    const { error: linkError } = await getSupabase().from("proposition_tags").insert(linkPayload);

    if (linkError) throw linkError;
  }

  return proposition;
}
