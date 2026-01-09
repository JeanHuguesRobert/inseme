import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listActes, getActe, createActe, updateActe } from "../services/api/actes.js";
import { useAuth } from "../contexts/AuthContext";

export function useActesList(params = {}) {
  const { session } = useAuth();
  const token = session?.access_token;
  return useQuery(["actes", params], () => listActes({ ...params, token }));
}

export function useActe(id) {
  const { session } = useAuth();
  const token = session?.access_token;
  return useQuery(["acte", id], () => getActe(id, { token }), { enabled: !!id });
}

export function useCreateActe() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const token = session?.access_token;
  return useMutation((payload) => createActe(payload, { token }), {
    onSuccess: () => qc.invalidateQueries(["actes"]),
  });
}

export function useUpdateActe() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const token = session?.access_token;
  return useMutation(({ id, payload }) => updateActe(id, payload, { token }), {
    onSuccess: (_, vars) => qc.invalidateQueries(["acte", vars.id]),
  });
}
