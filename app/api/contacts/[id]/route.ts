import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/contacts/[id] - Get single contact
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // For now, allow unauthenticated access for testing
    // In production, add authentication and user_id check

    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', params.id)
      // .eq('user_id', user.id) // Enable in production
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      contact,
    });

  } catch (error) {
    console.error('Get contact error:', error);
    return NextResponse.json(
      { error: 'Contact not found' },
      { status: 404 }
    );
  }
}

// PUT /api/contacts/[id] - Update contact
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // For now, allow unauthenticated access for testing

    const body = await request.json();

    // Build update object (only include provided fields)
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.firstName !== undefined) updateData.first_name = body.firstName;
    if (body.lastName !== undefined) updateData.last_name = body.lastName;
    if (body.company !== undefined) updateData.company = body.company;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.inferredEmail !== undefined) updateData.inferred_email = body.inferredEmail;
    if (body.confirmedEmail !== undefined) updateData.confirmed_email = body.confirmedEmail;
    if (body.emailConfidence !== undefined) updateData.email_confidence = body.emailConfidence;
    if (body.companyDomain !== undefined) updateData.company_domain = body.companyDomain;
    if (body.companyIndustry !== undefined) updateData.company_industry = body.companyIndustry;
    if (body.companySize !== undefined) updateData.company_size = body.companySize;
    if (body.linkedinUrl !== undefined) updateData.linkedin_url = body.linkedinUrl;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.lastContactedAt !== undefined) updateData.last_contacted_at = body.lastContactedAt;

    const { data: contact, error } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', params.id)
      // .eq('user_id', user.id) // Enable in production
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      contact,
      message: 'Contact updated successfully',
    });

  } catch (error) {
    console.error('Update contact error:', error);
    return NextResponse.json(
      { error: 'Failed to update contact', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/contacts/[id] - Delete contact
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // For now, allow unauthenticated access for testing

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', params.id);
      // .eq('user_id', user.id); // Enable in production

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Contact deleted successfully',
    });

  } catch (error) {
    console.error('Delete contact error:', error);
    return NextResponse.json(
      { error: 'Failed to delete contact', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
