# Integration Guide - UX Improvements

## Quick Start: How to Use the New Components

### 1. Add Toast Notifications to Actions

**Before:**
```typescript
const handleSave = async () => {
  try {
    await saveContact(data);
    setMessage('Contact saved!');
  } catch (error) {
    setMessage('Error saving contact');
  }
};
```

**After:**
```typescript
import { showToast } from '@/lib/toast';

const handleSave = async () => {
  try {
    await saveContact(data);
    showToast.success('Contact saved successfully!');
  } catch (error) {
    showToast.error('Failed to save contact', {
      action: () => handleSave() // Retry button
    });
  }
};

// Or use promise-based for automatic loading/success/error
const handleSave = async () => {
  await showToast.promise(
    saveContact(data),
    {
      loading: 'Saving contact...',
      success: 'Contact saved!',
      error: 'Failed to save contact'
    }
  );
};
```

### 2. Replace Loading States with Skeletons

**Before:**
```typescript
if (loading) return <div>Loading...</div>;
```

**After:**
```typescript
import { StatCardSkeleton, ListSkeleton } from '@/components/ui/skeleton';

if (loading) {
  return (
    <>
      <StatCardSkeleton />
      <ListSkeleton count={5} />
    </>
  );
}
```

### 3. Add Empty States

**Before:**
```typescript
if (contacts.length === 0) {
  return <div>No contacts found</div>;
}
```

**After:**
```typescript
import { EmptyContacts } from '@/components/empty-state';

if (contacts.length === 0) {
  return <EmptyContacts onAddContact={() => setShowDialog(true)} />;
}
```

### 4. Add Animations to Components

**Before:**
```typescript
<Card>
  <CardContent>...</CardContent>
</Card>
```

**After:**
```typescript
import { AnimatedCard, FadeInCard } from '@/components/ui/animated-card';

<AnimatedCard hoverLift>
  <CardContent>...</CardContent>
</AnimatedCard>

// Or with entrance animation
<FadeInCard delay={0.2}>
  <CardContent>...</CardContent>
</FadeInCard>
```

**Staggered Grid:**
```typescript
import { StaggeredCards } from '@/components/ui/animated-card';

<StaggeredCards staggerDelay={0.1}>
  {items.map(item => (
    <Card key={item.id}>
      <CardContent item={item} />
    </Card>
  ))}
</StaggeredCards>
```

### 5. Enable Command Palette

**In your dashboard layout:**
```typescript
import { DashboardWrapper } from '@/components/dashboard-wrapper';

export default function DashboardLayout({ children }) {
  return (
    <DashboardWrapper>
      <YourLayout>
        {children}
      </YourLayout>
    </DashboardWrapper>
  );
}
```

Now users can press `⌘K` to open the command palette!

## Example: Complete Page Transformation

### Before (Basic)
```typescript
export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/contacts')
      .then(res => res.json())
      .then(data => setContacts(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Contacts</h1>
      {contacts.map(contact => (
        <div key={contact.id}>{contact.name}</div>
      ))}
    </div>
  );
}
```

### After (Polished)
```typescript
import { useState, useEffect } from 'react';
import { showToast } from '@/lib/toast';
import { EmptyContacts } from '@/components/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { StaggeredCards } from '@/components/ui/animated-card';
import { AnimatedButton } from '@/components/ui/animated-button';

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/contacts');
      const data = await res.json();
      setContacts(data);
    } catch (error) {
      showToast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleAddContact = async (newContact) => {
    // Optimistic update
    setContacts([...contacts, { ...newContact, id: 'temp' }]);
    setShowAddDialog(false);

    try {
      const saved = await fetch('/api/contacts', {
        method: 'POST',
        body: JSON.stringify(newContact)
      }).then(r => r.json());

      // Replace temp with real data
      setContacts(prev => prev.map(c =>
        c.id === 'temp' ? saved : c
      ));

      showToast.success('Contact added successfully!');
    } catch (error) {
      // Rollback on error
      setContacts(prev => prev.filter(c => c.id !== 'temp'));
      showToast.error('Failed to add contact', {
        action: () => handleAddContact(newContact)
      });
    }
  };

  // Loading state with skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-8 w-32 bg-muted animate-pulse rounded" />
          <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        </div>
        <ListSkeleton count={5} />
      </div>
    );
  }

  // Empty state
  if (contacts.length === 0) {
    return <EmptyContacts onAddContact={() => setShowAddDialog(true)} />;
  }

  // Success state with animations
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Contacts</h1>
        <AnimatedButton onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Contact
        </AnimatedButton>
      </div>

      <StaggeredCards staggerDelay={0.1}>
        {contacts.map(contact => (
          <ContactCard key={contact.id} contact={contact} />
        ))}
      </StaggeredCards>

      <AddContactDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleAddContact}
      />
    </div>
  );
}
```

## Common Patterns

### Pattern 1: Data Fetching with Full UX
```typescript
const { data, loading, error, refetch } = useDataFetching('/api/data');

if (loading) return <Skeleton />;
if (error) return <ErrorState error={error} onRetry={refetch} />;
if (!data || data.length === 0) return <EmptyState />;

return <DataDisplay data={data} />;
```

### Pattern 2: Form Submission with Feedback
```typescript
const handleSubmit = async (formData) => {
  await showToast.promise(
    submitForm(formData),
    {
      loading: 'Submitting...',
      success: (result) => `${result.name} saved!`,
      error: (err) => err.message || 'Submission failed'
    }
  );
};
```

### Pattern 3: Delete with Confirmation
```typescript
const handleDelete = async (id) => {
  const confirm = window.confirm('Are you sure?');
  if (!confirm) return;

  // Optimistic delete
  setItems(prev => prev.filter(item => item.id !== id));
  showToast.success('Item deleted');

  try {
    await deleteItem(id);
  } catch (error) {
    // Rollback
    setItems(prevItems);
    showToast.error('Failed to delete item');
  }
};
```

### Pattern 4: Search with Debounce
```typescript
import { useDebouncedCallback } from 'use-debounce';

const [searchQuery, setSearchQuery] = useState('');
const [results, setResults] = useState([]);
const [searching, setSearching] = useState(false);

const debouncedSearch = useDebouncedCallback(
  async (query) => {
    if (!query) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const data = await searchAPI(query);
      setResults(data);
    } catch (error) {
      showToast.error('Search failed');
    } finally {
      setSearching(false);
    }
  },
  500
);

useEffect(() => {
  debouncedSearch(searchQuery);
}, [searchQuery]);
```

## Checklist for Each Page

- [ ] Replace "Loading..." with skeleton loaders
- [ ] Add empty states for zero data scenarios
- [ ] Add success toasts for actions
- [ ] Add error toasts with retry for failures
- [ ] Use animated cards for hover effects
- [ ] Use animated buttons for CTAs
- [ ] Add optimistic updates where possible
- [ ] Implement proper error boundaries
- [ ] Add ARIA labels for accessibility
- [ ] Test keyboard navigation
- [ ] Test on mobile devices

## Priority Order

1. **Critical**: Add toast notifications to all actions
2. **Critical**: Replace loading text with skeletons
3. **High**: Add empty states
4. **High**: Enable command palette
5. **Medium**: Add animations to cards/buttons
6. **Medium**: Implement optimistic updates
7. **Low**: Add advanced animations
8. **Low**: Add data visualizations

## Testing Checklist

- [ ] All actions show feedback (toast/loading)
- [ ] Skeletons match final content layout
- [ ] Empty states are actionable
- [ ] Command palette works (⌘K)
- [ ] Animations don't lag on slower devices
- [ ] Keyboard shortcuts work
- [ ] Screen reader announces changes
- [ ] Mobile touch targets are 44x44px minimum
- [ ] Error states provide retry option
- [ ] Loading states are immediate (no delay)
