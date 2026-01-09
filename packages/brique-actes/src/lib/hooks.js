import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@inseme/cop-host";
import { listActes, getActe, createActe, updateActe } from "./api.js";

export function useActesList(params = {}) {
  const { session } = useCurrentUser();
  const token = session?.access_token;
  return useQuery(["actes", params], () => listActes({ ...params, token }));
}

export function useActe(id) {
  const { session } = useCurrentUser();
  const token = session?.access_token;
  return useQuery(["acte", id], () => getActe(id, { token }), { enabled: !!id });
}

export function useCreateActe() {
  const qc = useQueryClient();
  const { session } = useCurrentUser();
  const token = session?.access_token;
  return useMutation((payload) => createActe(payload, { token }), {
    onSuccess: () => qc.invalidateQueries(["actes"]),
  });
}

export function useUpdateActe() {
  const qc = useQueryClient();
  const { session } = useCurrentUser();
  const token = session?.access_token;
  return useMutation(({ id, payload }) => updateActe(id, payload, { token }), {
    onSuccess: (_, vars) => qc.invalidateQueries(["acte", vars.id]),
  });
}
