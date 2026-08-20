import { useMutation } from '@tanstack/react-query'
import type { Address } from '@grandxl/types'
import { usersApi, type AddAddressDto } from '@grandxl/api-client'
import { useAuthStore } from '../../../store/auth.store'

export function useAddresses() {
  const user = useAuthStore((s) => s.user)
  return {
    addresses: (user?.addresses ?? []) as Address[],
    defaultAddressId: user?.defaultAddressId ?? null,
  }
}

export function useAddAddress() {
  const updateUser = useAuthStore((s) => s.updateUser)
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: (dto: AddAddressDto) => usersApi.addAddress(dto),
    onSuccess: (res) => {
      const newAddress = res.data.data as Address
      if (user) {
        const updatedAddresses = [...user.addresses, newAddress]
        updateUser({
          addresses: updatedAddresses,
          // auto-default: backend sets this when it's the first address
          ...(user.addresses.length === 0 ? { defaultAddressId: newAddress._id } : {}),
        })
      }
    },
  })
}

export function useDeleteAddress() {
  const updateUser = useAuthStore((s) => s.updateUser)
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: (addressId: string) => usersApi.deleteAddress(addressId),
    onMutate: (addressId) => {
      if (user) {
        updateUser({ addresses: user.addresses.filter((a) => a._id !== addressId) })
      }
    },
  })
}

export function useSetDefaultAddress() {
  const updateUser = useAuthStore((s) => s.updateUser)

  return useMutation({
    mutationFn: (addressId: string) => usersApi.setDefaultAddress(addressId),
    onSuccess: (_res, addressId) => {
      updateUser({ defaultAddressId: addressId })
    },
  })
}
